import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ASKFISH_MAX_MONTHS, ASKFISH_PAGES } from "@repo/domain/askfish";
import { METRICS } from "@repo/domain/metrics";
import { activeCountry } from "../lib/country";
import { AskFishQueryError, executeAskFishQuery } from "./query";
import { semanticCatalogForCountry } from "./semantic-catalog";

/*
 * The endpoints the AskFish service calls, server to server, under
 * `/api/askfish`, with `ASKFISH_SERVICE_TOKEN`: it reads the data behind an
 * answer here. (The browser never talks to AskFish: the chat asks it through
 * the `askfish` procedures, `../router/askfish.ts`.) The request and response
 * shapes are AskFish's contract; change them on both sides or not at all.
 */

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Compare the bearer token without telling, through timing, how much of it matched. */
function tokenMatches(req: Request, expected: string) {
  const header = req.headers.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "");
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** The semantic catalog as the planner may see it for this deployment's country. */
const catalog = () => json(semanticCatalogForCountry(activeCountry().countryCode));

/** One catalog-validated read of source records (`query.ts`). */
const query = async (req: Request) =>
  json(await executeAskFishQuery(await req.json().catch(() => null)));

const catchTrendsRequest = z.object({
  operation: z.literal(ASKFISH_PAGES.catch_trends.operation),
  countryCode: z.string().min(2).max(3),
  districts: z.array(z.string().min(1)).min(1).max(100),
  metric: z.enum(ASKFISH_PAGES.catch_trends.metrics),
  months: z.number().int().min(1).max(ASKFISH_MAX_MONTHS).nullable(),
});

/**
 * AskFish's first operation: one metric of the monthly summaries, per district
 * and month. It is the catalog query of that dataset (`query.ts`), so it reads
 * the same rows, keeps the newest version of each and checks the country and
 * the districts the same way; only the reply is shaped as the operation wants.
 */
async function catchTrends(req: Request) {
  const parsed = catchTrendsRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "Invalid Catch Trends request.", details: parsed.error.flatten() }, 400);
  }
  const { countryCode, districts, metric, months, operation } = parsed.data;
  const result = await executeAskFishQuery({
    contractVersion: "1.0",
    countryCode,
    dataset: "monthly_district_summary",
    measure: metric,
    filters: { district: districts },
    timeRange: months === null ? null : { lastMonths: months },
    // The dataset's own ceiling: a wider request is refused, never cut short.
    limit: 10_000,
    scope: { mode: "unrestricted", pageId: null, dashboardFilters: null },
  });
  const series = result.records
    .map((r) => ({
      date: String(r.dimensions.month),
      district: String(r.dimensions.district),
      value: r.value,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.district.localeCompare(b.district));

  return json({
    operation,
    filters: { countryCode, districts, metric, months },
    metric: {
      label: result.measureMetadata.label,
      unit: result.measureMetadata.unit,
      aggregation: METRICS[metric].overDistricts,
    },
    source: {
      system: "Peskas",
      dataset: result.source.collection,
      deployment: result.source.deployment,
      endpoint: "/api/askfish/catch-trends",
    },
    dataVersion: result.dataVersion,
    rawRecordCount: result.rawRecordCount,
    duplicateRecordCount: result.duplicateRecordCount,
    recordCount: series.length,
    series,
  });
}

const ROUTES: Record<
  string,
  { method: string; run: (req: Request) => Response | Promise<Response> }
> = {
  catalog: { method: "GET", run: catalog },
  "catch-trends": { method: "POST", run: catchTrends },
  query: { method: "POST", run: query },
};

/** Answer a request under `/api/askfish`; every route needs the service token. */
export async function handleAskFish(req: Request): Promise<Response> {
  const route = ROUTES[new URL(req.url).pathname.replace(/^\/api\/askfish\/|\/$/g, "")];
  if (!route) return json({ error: "Not found." }, 404);
  if (req.method !== route.method) return json({ error: "Method not allowed." }, 405);

  // Without a token configured nothing is served, rather than everything.
  // ASKFISH SHARED TOKEN: Accept the same server-only credential that the
  // Peskas tRPC router sends to AskFish. Keep the legacy setting as fallback.
  const token = process.env.ASKFISH_SHARED_TOKEN || process.env.ASKFISH_SERVICE_TOKEN;
  if (!token) return json({ error: "AskFish service token is not configured." }, 503);
  if (!tokenMatches(req, token)) return json({ error: "Unauthorized." }, 401);

  try {
    return await route.run(req);
  } catch (error) {
    // A refused query says why; anything else is logged and stays on the server.
    if (error instanceof AskFishQueryError) return json({ error: error.message }, error.statusCode);
    console.error(">>> AskFish error on", req.url, error);
    return json({ error: "Internal server error" }, 500);
  }
}
