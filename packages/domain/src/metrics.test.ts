import { expect, test } from "vitest";
import { combine, GEAR_METRIC_KEYS, isMetricKey, METRICS } from "./metrics";

test("combine sums or averages, skipping missing values", () => {
  expect(combine([1, 2, null, undefined, NaN, 3], "sum")).toBe(6);
  expect(combine([1, 2, null, undefined, NaN, 3], "mean")).toBe(2);
  expect(combine([null, NaN], "sum")).toBeNull();
  expect(combine([], "mean")).toBeNull();
});

// The rules agreed in CONTEXT.md: a region's catch is its districts' total, never their mean.
test("totals add up across months and districts; fisher counts add up across districts only", () => {
  for (const key of ["n_submissions", "estimated_catch_tn", "estimated_revenue"] as const) {
    expect(METRICS[key]).toMatchObject({ overMonths: "sum", overDistricts: "sum" });
  }
  expect(METRICS.n_fishers).toMatchObject({ overMonths: "mean", overDistricts: "sum" });
  expect(METRICS.mean_cpue).toMatchObject({ overMonths: "mean", overDistricts: "mean" });
});

test("gear summaries carry CPUE and RPUE", () => {
  expect(GEAR_METRIC_KEYS).toEqual(["mean_cpue", "mean_rpue"]);
});

test("isMetricKey rejects prototype names", () => {
  expect(isMetricKey("mean_cpue")).toBe(true);
  expect(isMetricKey("toString")).toBe(false);
});
