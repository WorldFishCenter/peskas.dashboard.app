// STAGE 1 STEP 1: Expose one service-to-service, read-only operation for the
// Catch Trends vertical slice. The browser never receives the service token or
// the authoritative MongoDB records directly from the dashboard UI.
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import getDb from "@repo/nosql";
import { MonthlySummaryDistrictModel } from "@repo/nosql/schema/monthly-summary-district";
import { activeCountry } from "@/config/countryConfig";

// STAGE 1 STEP 1: Keep the public contract deliberately narrow. These are the
// two metrics currently available on the Peskas Catch page.
const catchTrendMetricSchema = z.enum(["mean_cpue", "estimated_catch_tn"]);

// STAGE 1 STEP 1: Accept only validated filters and a known operation version;
// unrestricted queries or generated code are intentionally out of scope.
const requestSchema = z.object({
  operation: z.literal("catch_trends.monthly_time_series.v1"),
  countryCode: z.string().min(2).max(3),
  districts: z.array(z.string().min(1)).min(1).max(100),
  metric: catchTrendMetricSchema,
  months: z.number().int().min(1).max(72).nullable(),
});

// STAGE 1 STEP 1: Pin this route to the Node runtime because it uses Mongoose
// and Node's constant-time token comparison.
export const runtime = "nodejs";

// STAGE 1 STEP 1: Compare service tokens without leaking matching-prefix timing
// information. A missing server-side secret is treated as a configuration error.
function serviceTokenStatus(request: NextRequest) {
  const expected = process.env.ASKFISH_SERVICE_TOKEN;
  if (!expected) return { configured: false, valid: false };

  const authorization = request.headers.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  const valid =
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);

  return { configured: true, valid };
}

// STAGE 1 STEP 1: Return the unit and aggregation semantics needed by AskFish's
// deterministic structured operation.
function metricMetadata(metric: z.infer<typeof catchTrendMetricSchema>) {
  if (metric === "estimated_catch_tn") {
    return { label: "Estimated catch", unit: "tonnes", aggregation: "sum" as const };
  }
  return {
    label: "Catch rate",
    unit: "kg/fisher/hour",
    aggregation: "mean" as const,
  };
}

// STAGE 1 STEP 1.3: monthly_summaries is already a district-month aggregate, so
// repeated rows must not be summed. Keep one canonical snapshot per district/month,
// preferring the newest explicit timestamp and then the Mongo ObjectId timestamp.
function canonicalizeDistrictMonths<T extends {
  _id: { getTimestamp: () => Date };
  gaul_2_name: string;
  date: Date;
  timestamp?: Date;
}>(records: T[]) {
  const canonical = new Map<string, T>();
  for (const record of records) {
    const dateKey = record.date.toISOString().split("T")[0];
    const key = `${dateKey}::${record.gaul_2_name}`;
    const existing = canonical.get(key);
    const recordUpdatedAt = (record.timestamp ?? record._id.getTimestamp()).getTime();
    const existingUpdatedAt = existing
      ? (existing.timestamp ?? existing._id.getTimestamp()).getTime()
      : Number.NEGATIVE_INFINITY;
    if (!existing || recordUpdatedAt >= existingUpdatedAt) canonical.set(key, record);
  }

  return Array.from(canonical.values()).sort((left, right) => {
    const dateDifference = left.date.getTime() - right.date.getTime();
    return dateDifference || left.gaul_2_name.localeCompare(right.gaul_2_name);
  });
}

// STAGE 1 STEP 1: This endpoint is the authoritative Peskas data boundary for
// the initial vertical slice. It queries the same MongoDB collection used by
// the Catch Trends chart rather than scraping or forwarding rendered chart data.
export async function POST(request: NextRequest) {
  const token = serviceTokenStatus(request);
  if (!token.configured) {
    return NextResponse.json(
      { error: "ASKFISH_SERVICE_TOKEN is not configured on Peskas." },
      { status: 503 },
    );
  }
  if (!token.valid) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Catch Trends request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { countryCode, districts, metric, months, operation } = parsed.data;
  if (countryCode !== activeCountry.countryCode) {
    return NextResponse.json(
      { error: `This deployment serves ${activeCountry.countryCode}, not ${countryCode}.` },
      { status: 400 },
    );
  }

  const validDistricts = new Set(activeCountry.districts);
  const invalidDistricts = districts.filter((district) => !validDistricts.has(district));
  if (invalidDistricts.length > 0) {
    return NextResponse.json(
      { error: "One or more districts are invalid for this deployment.", invalidDistricts },
      { status: 400 },
    );
  }

  await getDb();

  const query: Record<string, unknown> = {
    gaul_2_name: { $in: districts },
    metric,
  };
  if (months !== null) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - months);
    query.date = { $gte: startDate, $lte: endDate };
  }

  const records = await MonthlySummaryDistrictModel.find(query)
    .sort({ date: 1, gaul_2_name: 1, timestamp: 1, _id: 1 })
    .lean();

  // STAGE 1 STEP 1.1: Historical monthly_summaries can contain a sparse row
  // without a numeric value. Exclude such observations from the structured
  // numeric series rather than coercing missing data to zero or weakening the
  // AskFish response contract.
  const validRecords = records.filter(
    (record) => typeof record.value === "number" && Number.isFinite(record.value),
  );

  // STAGE 1 STEP 1.3: Collapse duplicate/versioned district-month summaries before
  // they cross the API boundary. This prevents duplicate Plotly points and protects
  // additive metrics such as estimated catch from accidental double counting.
  const canonicalRecords = canonicalizeDistrictMonths(validRecords);
  const duplicateRecordCount = validRecords.length - canonicalRecords.length;

  // STAGE 1 STEP 1.3: Derive provenance from the canonical rows actually returned,
  // while exposing how many raw duplicate rows were resolved for auditability.
  const versionDates = canonicalRecords.map((record) => record.timestamp ?? record.date);
  const dataVersion = versionDates.length
    ? new Date(Math.max(...versionDates.map((date) => date.getTime()))).toISOString()
    : null;

  return NextResponse.json({
    operation,
    filters: { countryCode, districts, metric, months },
    metric: metricMetadata(metric),
    source: {
      system: "Peskas",
      dataset: "monthly_summaries",
      deployment: activeCountry.countryName,
      endpoint: "/api/askfish/catch-trends",
    },
    dataVersion,
    // STAGE 1 STEP 1.3: Keep canonical and raw counts separate so AskFish can show
    // exactly what data it analyzed without hiding upstream duplicate resolution.
    rawRecordCount: validRecords.length,
    duplicateRecordCount,
    recordCount: canonicalRecords.length,
    series: canonicalRecords.map((record) => ({
      date: record.date.toISOString().split("T")[0],
      district: record.gaul_2_name,
      value: record.value,
    })),
  });
}
