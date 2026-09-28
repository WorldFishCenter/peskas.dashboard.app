/**
 * Every metric the portal summaries carry and how its values combine (see
 * Metric, Total metric and Average metric in CONTEXT.md). Labels, units and
 * explanations stay in the app's locale files as
 * `metric-<key>-{title,unit,desc,how,limits}`; this module only knows the keys.
 */

/** Summed (a Total metric) or averaged, weighted by landings (an Average metric). */
export type Combine = "sum" | "mean";

type MetricSpec = {
  overMonths: Combine;
  overDistricts: Combine;
  /** The same measure's name in the gear summaries. */
  gearIndicator?: "cpue" | "rpue";
  /** Only in the district summaries: the monthly summaries don't carry it. */
  districtsOnly?: true;
  /** Scaled up from the surveyed landings to the district's fleet, rather than recorded. */
  estimated?: true;
};

const TOTAL = { overMonths: "sum", overDistricts: "sum" } as const;
const AVERAGE = { overMonths: "mean", overDistricts: "mean" } as const;

const catalogue = <K extends string>(specs: Record<K, MetricSpec>) => specs;

/** District and monthly summaries (`districts_summaries`, `monthly_summaries`), in display order. */
export const METRICS = catalogue({
  mean_cpue: { ...AVERAGE, gearIndicator: "cpue" },
  mean_rpue: { ...AVERAGE, gearIndicator: "rpue" },
  mean_catch_kg: AVERAGE,
  mean_catch_price: AVERAGE,
  // Crew size: the mean number of fishers on a trip, so districts average too.
  n_fishers: { ...AVERAGE, districtsOnly: true },
  n_submissions: { ...TOTAL, districtsOnly: true },
  trip_duration_hrs: { ...AVERAGE, districtsOnly: true },
  mean_price_kg: AVERAGE,
  estimated_fishing_trips: { ...TOTAL, estimated: true },
  estimated_revenue: { ...TOTAL, estimated: true },
  estimated_catch_tn: { ...TOTAL, estimated: true },
});

export type MetricKey = keyof typeof METRICS;
export const METRIC_KEYS = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];

/** Metrics the monthly summaries carry. */
export const MONTHLY_METRIC_KEYS = METRIC_KEYS.filter((k) => !METRICS[k].districtsOnly) as [
  MetricKey,
  ...MetricKey[],
];

/** Per-species metrics in `taxa_summaries`. */
export const TAXA_METRICS = catalogue({
  catch_kg: TOTAL,
  mean_length: AVERAGE,
  price_kg: AVERAGE,
});

export type TaxaMetricKey = keyof typeof TAXA_METRICS;
export const TAXA_METRIC_KEYS = Object.keys(TAXA_METRICS) as [TaxaMetricKey, ...TaxaMetricKey[]];

export const isMetricKey = (key: string): key is MetricKey =>
  (METRIC_KEYS as string[]).includes(key);

/**
 * Combine values by a rule. Null, undefined and NaN are skipped; nothing left
 * gives null. A mean with `weights` (landings behind each value) is weighted
 * by them, so a district with 5 landings counts less than one with 500; it
 * falls back to the plain mean when no value has a positive weight.
 */
export function combine(
  values: readonly (number | null | undefined)[],
  how: Combine,
  weights?: readonly (number | null | undefined)[],
): number | null {
  const valid = (v: number | null | undefined): v is number =>
    typeof v === "number" && !Number.isNaN(v);
  const vals = values.filter(valid);
  if (!vals.length) return null;
  if (how === "sum") return vals.reduce((a, b) => a + b, 0);

  let total = 0;
  let weight = 0;
  values.forEach((v, i) => {
    const w = weights?.[i];
    if (valid(v) && valid(w) && w > 0) {
      total += v * w;
      weight += w;
    }
  });
  return weight > 0 ? total / weight : vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Fewer landings than this behind a value and the dashboard marks it as thin. */
export const FEW_LANDINGS = 10;

/**
 * Confidence in an estimated total from the share of the district's boats that
 * carried a tracker (`sampling_rate`). The bands are the ones coasts documents
 * in `estimate_fleet_activity()`.
 */
export type Confidence = "high" | "medium" | "low";
export function confidenceBand(samplingRate: number | null | undefined): Confidence | null {
  if (samplingRate == null || Number.isNaN(samplingRate)) return null;
  return samplingRate >= 0.3 ? "high" : samplingRate >= 0.1 ? "medium" : "low";
}

/** FishBase's intrinsic vulnerability to fishing (0–100), grouped in quarters of the scale. */
export const VULNERABILITY_BANDS = ["low", "moderate", "high", "very_high"] as const;
export type VulnerabilityBand = (typeof VULNERABILITY_BANDS)[number];
export function vulnerabilityBand(score: number | null | undefined): VulnerabilityBand | null {
  if (score == null || Number.isNaN(score)) return null;
  return VULNERABILITY_BANDS[Math.min(3, Math.floor(score / 25))];
}
