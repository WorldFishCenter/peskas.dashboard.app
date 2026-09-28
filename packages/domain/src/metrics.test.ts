import { expect, test } from "vitest";
import {
  combine,
  confidenceBand,
  isMetricKey,
  METRICS,
  MONTHLY_METRIC_KEYS,
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
  ]);
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
