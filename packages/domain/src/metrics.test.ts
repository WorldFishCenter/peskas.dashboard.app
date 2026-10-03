import { expect, test } from "vitest";
import {
  changeHidden,
  combine,
  comparable,
  confidenceBand,
  isMetricKey,
  methodKeys,
  METRICS,
  MONTHLY_METRIC_KEYS,
  methodCoverage,
  vulnerabilityBand,
} from "./metrics";

test("combine sums or averages, skipping missing values", () => {
  expect(combine([1, 2, null, undefined, NaN, 3], "sum")).toBe(6);
  expect(combine([1, 2, null, undefined, NaN, 3], "mean")).toBe(2);
  expect(combine([null, NaN], "sum")).toBeNull();
  expect(combine([], "mean")).toBeNull();
});

test("a mean with weights counts each value by the landings behind it", () => {
  expect(combine([1, 3], "mean", [5, 495])).toBeCloseTo(2.98);
  // A value with no landings behind it carries no weight...
  expect(combine([1, 3], "mean", [0, 10])).toBe(3);
  // ...unless nothing has any, when the plain mean is all there is.
  expect(combine([1, 3], "mean", [null, 0])).toBe(2);
  // Weights never change a total.
  expect(combine([1, 3], "sum", [5, 495])).toBe(4);
});

// The rules agreed in CONTEXT.md: a region's catch is its districts' total, never their mean.
test("totals add up across months and districts; crew size and rates average", () => {
  for (const key of [
    "n_submissions",
    "estimated_catch_tn",
    "estimated_revenue",
    "estimated_fishing_trips",
    "estimated_catch_tn_fao",
    "estimated_revenue_fao",
    "estimated_fishing_trips_fao",
  ] as const) {
    expect(METRICS[key]).toMatchObject({ overMonths: "sum", overDistricts: "sum" });
  }
  for (const key of ["n_fishers", "mean_cpue", "mean_catch_kg"] as const) {
    expect(METRICS[key]).toMatchObject({ overMonths: "mean", overDistricts: "mean" });
  }
});

test("monthly summaries carry no fisher, submission or trip-duration counts", () => {
  expect(MONTHLY_METRIC_KEYS).toEqual([
    "mean_cpue",
    "mean_rpue",
    "mean_catch_kg",
    "mean_catch_price",
    "mean_price_kg",
    "estimated_fishing_trips",
    "estimated_revenue",
    "estimated_catch_tn",
    "estimated_fishing_trips_fao",
    "estimated_revenue_fao",
    "estimated_catch_tn_fao",
  ]);
});

test("each estimate both methods make names the other as its twin", () => {
  for (const [key, spec] of Object.entries(METRICS)) {
    if (!spec.twin) continue;
    expect(METRICS[spec.twin]).toMatchObject({ twin: key, estimated: true });
    expect(!!METRICS[spec.twin].artfish).toBe(!spec.artfish);
  }
});

test("both methods' totals add up only what both estimate, unless one estimates none of it", () => {
  const cells = [
    { estimated_catch_tn: 4, estimated_catch_tn_fao: 6 },
    { estimated_catch_tn_fao: 9 }, // no tracked boats there
    { estimated_catch_tn: 2 },
  ];
  const shared = { cells: [cells[0]], shared: true };
  expect(comparable(cells, "estimated_catch_tn")).toEqual(shared);
  expect(comparable(cells, "estimated_catch_tn_fao")).toEqual(shared);
  // With nothing to compare with, a method keeps all it estimates.
  const alone = [{ estimated_catch_tn_fao: 9 }, { estimated_catch_tn_fao: 1 }];
  expect(comparable(alone, "estimated_catch_tn_fao")).toEqual({ cells: alone, shared: false });
  // Metrics only one method makes are left as they are.
  expect(comparable(cells, "mean_cpue")).toEqual({ cells, shared: false });
  // The two district-months only one method estimates are the ones left out.
  expect(methodCoverage(cells, "estimated_catch_tn")).toEqual({ shared: 1, unshared: 2 });
  expect(methodCoverage(alone, "estimated_catch_tn")).toEqual({ shared: 0, unshared: 0 });
  // Sharing nothing, each method keeps its own and nothing is left out.
  const apart = [{ estimated_catch_tn: 4 }, { estimated_catch_tn_fao: 9 }];
  expect(comparable(apart, "estimated_catch_tn").cells).toBe(apart);
  expect(methodCoverage(apart, "estimated_catch_tn")).toEqual({ shared: 0, unshared: 0 });
});

test("each method's key, and why a change is hidden", () => {
  expect(methodKeys("estimated_revenue_fao")).toEqual({
    tracker: "estimated_revenue",
    artfish: "estimated_revenue_fao",
  });
  expect(methodKeys("estimated_revenue")).toBe(methodKeys("estimated_revenue"));
  expect(methodKeys("mean_cpue")).toBeNull();
  expect(changeHidden("estimated_catch_tn_fao", 0.5)).toBe("artfish");
  expect(changeHidden("estimated_catch_tn", 0.05)).toBe("low");
  expect(changeHidden("estimated_catch_tn", 0.3)).toBeNull();
  expect(changeHidden("mean_cpue", 0.05)).toBeNull();
});

test("isMetricKey rejects prototype names", () => {
  expect(isMetricKey("mean_cpue")).toBe(true);
  expect(isMetricKey("toString")).toBe(false);
});

test("confidence follows the share of the fleet tracked", () => {
  expect(confidenceBand(0.3)).toBe("high");
  expect(confidenceBand(0.1)).toBe("medium");
  expect(confidenceBand(0.05)).toBe("low");
  expect(confidenceBand(null)).toBeNull();
});

test("vulnerability bands are quarters of the 0-100 scale", () => {
  expect([0, 24.9, 25, 50, 74.9, 75, 100].map(vulnerabilityBand)).toEqual([
    "low",
    "low",
    "moderate",
    "high",
    "high",
    "very_high",
    "very_high",
  ]);
  expect(vulnerabilityBand(undefined)).toBeNull();
});
