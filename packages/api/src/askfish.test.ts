import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import getDb from "@repo/nosql";
import { canonicalizeNewestByKey } from "./canonicalization";
import {
  resolveExactSemanticCategoryValue,
  resolveSemanticCategoryValue,
  semanticCategoryKey,
} from "./category-resolution";
import { handleAskFish } from "./handler";
import { semanticCatalog, semanticCatalogForCountry } from "./semantic-catalog";

/** The month `ago` complete months back, dated as coasts dates it; month(-1) is this month. */
function month(ago: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - ago - 1, 1));
}
const day = (ago: number) => month(ago).toISOString().slice(0, 10);

const call = (path: string, body?: unknown, token = "secret") =>
  handleAskFish(
    new Request(`http://localhost/api/askfish/${path}`, {
      method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // The catalog binds the portal summaries to the `portal-prod` database.
  process.env.MONGODB_URI = mongod.getUri("portal-prod");
  process.env.VITE_COUNTRY_CODE = "TZ";
  process.env.ASKFISH_SERVICE_TOKEN = "secret";
  delete process.env.ASKFISH_SHARED_TOKEN;
  const db = await getDb();

  const row = (value: number, ago: number, pushed: string) => ({
    gaul_2_name: "Wete",
    metric: "mean_cpue",
    value,
    date: month(ago),
    timestamp: new Date(pushed),
  });
  await db.connection.collection("monthly_summaries").insertMany([
    row(1, 0, "2026-09-01T00:00:00Z"), // an older version of last month's row
    row(2, 0, "2026-09-02T00:00:00Z"),
    row(5, 5, "2026-09-02T00:00:00Z"), // outside a 3-month window
    row(999, -1, "2026-09-02T00:00:00Z"), // this month, still coming in
  ]);
});

afterAll(async () => {
  await (await getDb()).disconnect();
  await mongod.stop();
});

test("every route needs the service token", async () => {
  expect((await call("catalog", undefined, "wrong")).status).toBe(401);
  expect((await call("nothing-here")).status).toBe(404);
  expect((await call("query")).status).toBe(405); // a GET on a POST route

  const catalog = await call("catalog");
  expect(catalog.status).toBe(200);
  const body = await catalog.json();
  expect(body.deployment.countryCode).toBe("TZ");
  // Kenya's BMU sources are bound to Kenya alone.
  expect(Object.keys(body.datasets)).not.toContain("kenya_bmu_monthly");

  delete process.env.ASKFISH_SERVICE_TOKEN;
  expect((await call("catalog")).status).toBe(503);
  process.env.ASKFISH_SERVICE_TOKEN = "secret";
});

// ASKFISH SHARED TOKEN: The same bearer key authorizes reverse data reads;
// a stale legacy credential cannot silently override it.
test("shared token authorizes catalog reads and overrides the legacy service token", async () => {
  process.env.ASKFISH_SHARED_TOKEN = "shared-server-only-secret";
  try {
    expect((await call("catalog", undefined, "secret")).status).toBe(401);
    const catalog = await call("catalog", undefined, "shared-server-only-secret");
    expect(catalog.status).toBe(200);
    expect((await catalog.json()).deployment.countryCode).toBe("TZ");
  } finally {
    delete process.env.ASKFISH_SHARED_TOKEN;
  }
});

test("a month window is the dashboard's, and a repeated row counts once", async () => {
  const query = await call("query", {
    contractVersion: "1.0",
    countryCode: "TZ",
    dataset: "monthly_district_summary",
    measure: "mean_cpue",
    scope: {
      mode: "restricted",
      pageId: "catch",
      dashboardFilters: { districts: ["Wete"], metric: "mean_cpue", months: 3 },
    },
  });
  const result = await query.json();
  expect(result.records).toEqual([{ dimensions: { district: "Wete", month: day(0) }, value: 2 }]);
  expect(result.duplicateRecordCount).toBe(1);
  // The last three complete months, to the last instant before this month.
  expect(result.scope.resolvedTimeWindow.startDate).toBe(month(2).toISOString());
  expect(new Date(result.scope.resolvedTimeWindow.endDate).getTime()).toBe(month(-1).getTime() - 1);

  const trends = await call("catch-trends", {
    operation: "catch_trends.monthly_time_series.v1",
    countryCode: "TZ",
    districts: ["Wete"],
    metric: "mean_cpue",
    months: 3,
  });
  const series = await trends.json();
  expect(series.series).toEqual([{ date: day(0), district: "Wete", value: 2 }]);
  expect(series).toMatchObject({ rawRecordCount: 2, duplicateRecordCount: 1, recordCount: 1 });
});

test("all time ends at the last complete month", async () => {
  const dashboardFilters = { districts: ["Wete"], metric: "mean_cpue", months: null };
  const query = await call("query", {
    contractVersion: "1.0",
    countryCode: "TZ",
    dataset: "monthly_district_summary",
    measure: "mean_cpue",
    scope: { mode: "restricted", pageId: "catch", dashboardFilters },
  });
  const result = await query.json();
  // Five months ago and last month; never this month's 999.
  expect(result.records.map((r: { value: number }) => r.value).sort()).toEqual([2, 5]);
  expect(result.scope.effectiveTimeRange).toBeNull();
  expect(result.scope.resolvedTimeWindow.startDate).toBeNull();
  expect(new Date(result.scope.resolvedTimeWindow.endDate).getTime()).toBe(month(-1).getTime() - 1);

  const trends = await call("catch-trends", {
    operation: "catch_trends.monthly_time_series.v1",
    countryCode: "TZ",
    districts: ["Wete"],
    metric: "mean_cpue",
    months: null,
  });
  expect((await trends.json()).series.map((p: { value: number }) => p.value)).toEqual([5, 2]);
});

test("a query outside the page's scope is refused with its reason", async () => {
  const refused = await call("query", {
    contractVersion: "1.0",
    countryCode: "TZ",
    dataset: "taxa_summary_district",
    measure: "catch_kg",
    scope: {
      mode: "restricted",
      pageId: "catch",
      dashboardFilters: { districts: ["Wete"], metric: "mean_cpue", months: null },
    },
  });
  expect(refused.status).toBe(400);
  expect((await refused.json()).error).toMatch(/outside the restricted 'catch' page scope/);
});

// The checks below came with AskFish as standalone scripts (stages 2.7.1, 2.7.3 and 3.3).

test("versions of one row collapse to the newest and are never added up", () => {
  const at = (iso: string) => new Date(iso);
  const four = [10, 20, 30, 40].map((value, i) => ({
    grain: "same",
    value,
    timestamp: at(`2026-08-0${i + 1}T00:00:00Z`),
  }));
  expect(canonicalizeNewestByKey(four, (r) => r.grain)).toEqual([four[3]]);

  // Without a timestamp, the ObjectId's creation time decides.
  const id = (iso: string) => ({ getTimestamp: () => at(iso) });
  const two = [
    { grain: "same", value: 5, _id: id("2026-08-01T00:00:00Z") },
    { grain: "same", value: 9, _id: id("2026-08-02T00:00:00Z") },
  ];
  expect(canonicalizeNewestByKey(two, (r) => r.grain).map((r) => r.value)).toEqual([9]);

  const mixed = [
    { grain: "A", value: 1, timestamp: at("2026-08-01T00:00:00Z") },
    { grain: "A", value: 2, timestamp: at("2026-08-02T00:00:00Z") },
    { grain: "B", value: 3, timestamp: at("2026-08-01T00:00:00Z") },
  ];
  expect(canonicalizeNewestByKey(mixed, (r) => r.grain).map((r) => r.value)).toEqual([2, 3]);
});

test("a gear or taxon label resolves to one observed value, or to none", () => {
  expect(semanticCategoryKey("Gill Net")).toBe("gillnet");
  expect(resolveSemanticCategoryValue("gillnet", ["Gill Net", "Hand Line"]).resolved).toBe(
    "Gill Net",
  );
  expect(resolveSemanticCategoryValue("Octopus", ["Octopuses nei", "Hilsa kelee"]).resolved).toBe(
    "Octopuses nei",
  );
  expect(resolveSemanticCategoryValue("Octopus", ["Octopuses nei", "Octopus cyanea"]).method).toBe(
    "ambiguous",
  );
  // Too short and broad to match by prefix.
  expect(resolveSemanticCategoryValue("net", ["Gill Net", "Lift Net"]).method).toBe("none");
});

test("Kenya's BMU sources stay at their own grain, bound to Kenya's app database", () => {
  expect(semanticCatalog.catalogVersion).toBe("0.5.0");
  for (const id of ["kenya_bmu_monthly", "kenya_bmu_gear_monthly"]) {
    const dataset = semanticCatalog.datasets[id]!;
    expect(dataset.pageScopes).toEqual([]);
    expect(Object.keys(dataset.bindings)).toEqual(["KE"]);
    expect(dataset.bindings.KE!.database).toBe("app");
    expect(dataset.geographicFrame?.namespace).toBe("kenya_bmu");
    const { acrossTime, acrossBmu } = dataset.measures.mean_cpue!.rollups;
    expect([acrossTime!.status, acrossBmu!.status]).toEqual(
      Array(2).fill("forbidden_source_grain_only"),
    );
  }
  expect(semanticCatalog.datasets.kenya_bmu_monthly!.bindings.KE!.collection).toBe("catch_monthly");
  expect(semanticCatalog.datasets.kenya_bmu_gear_monthly!.bindings.KE!.collection).toBe(
    "gear_summaries",
  );

  // A BMU name matches exactly, give or take case and punctuation; never by prefix.
  const bmus = ["Example BMU", "Other BMU"];
  expect(resolveExactSemanticCategoryValue("example-bmu", bmus).resolved).toBe("Example BMU");
  expect(resolveExactSemanticCategoryValue("Example", bmus).resolved).toBeNull();
});

// ASKFISH GEO CAPABILITIES: All three country catalogs expose the same shared
// semantic district dataset with a country-bound analytical substitution policy.
// Kenya's native BMU capability stays independent of the district fallback.
test("country-scoped alternatives never invent BMU joins or cross-country sources", () => {
  for (const country of ["KE", "TZ", "MZ"]) {
    const view = semanticCatalogForCountry(country);
    expect(view.deployment.countryCode).toBe(country);
    const alternative = view.geographicAlternatives.find(
      (rule) => rule.requestedLevel === "bmu" && rule.replacementLevel === "district",
    );
    expect(alternative).toBeDefined();
    expect(alternative?.targetDataset).toBe("monthly_district_summary");
    expect(alternative?.supportedMeasures).toEqual(
      expect.arrayContaining(["estimated_catch_tn", "estimated_revenue"]),
    );
    expect(Object.keys(view.datasets)).toContain("monthly_district_summary");
    expect(view.datasets.monthly_district_summary.binding).toEqual(
      semanticCatalog.datasets.monthly_district_summary.bindings[country],
    );
    expect(alternative?.reason).toMatch(/NOT|not/i);
  }
  expect(Object.keys(semanticCatalogForCountry("TZ").datasets)).not.toContain("kenya_bmu_monthly");
  expect(Object.keys(semanticCatalogForCountry("KE").datasets)).toContain("kenya_bmu_monthly");
});
