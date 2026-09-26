/**
 * Every metric the portal summaries carry and how its values combine (see
 * Metric, Total metric and Average metric in CONTEXT.md). Labels, units and
 * descriptions stay in the app's locale files as `metric-<key>-{title,unit,desc}`;
 * this module only knows the keys.
 */

/** Summed (a Total metric) or averaged, unweighted (an Average metric). */
export type Combine = "sum" | "mean";

type MetricSpec = {
  overMonths: Combine;
  overDistricts: Combine;
  /** The same measure's name in the gear summaries. */
  gearIndicator?: "cpue" | "rpue";
  /** Only in the district summaries: the monthly summaries don't carry it. */
  districtsOnly?: true;
  /** Always shown in millions ("0.9M"), so an axis never mixes "850,000" and "1.2M". */
  inMillions?: true;
};

const TOTAL = { overMonths: "sum", overDistricts: "sum" } as const;
// ponytail: unweighted means across districts; weight by n_submissions if regional CPUE looks off.
const AVERAGE = { overMonths: "mean", overDistricts: "mean" } as const;

const catalogue = <K extends string>(specs: Record<K, MetricSpec>) => specs;

/** District and monthly summaries (`districts_summaries`, `monthly_summaries`), in display order. */
export const METRICS = catalogue({
  mean_cpue: { ...AVERAGE, gearIndicator: "cpue" },
  mean_rpue: { ...AVERAGE, gearIndicator: "rpue" },
  // Fisher count: fishers in a typical month, added up across districts.
  n_fishers: { overMonths: "mean", overDistricts: "sum", districtsOnly: true },
  n_submissions: { ...TOTAL, districtsOnly: true },
  trip_duration_hrs: { ...AVERAGE, districtsOnly: true },
  mean_price_kg: AVERAGE,
  estimated_revenue: { ...TOTAL, inMillions: true },
  estimated_catch_tn: TOTAL,
});

export type MetricKey = keyof typeof METRICS;
export const METRIC_KEYS = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];

/** Metrics the gear summaries also carry, under their `gearIndicator` name. */
export const GEAR_METRIC_KEYS = METRIC_KEYS.filter((k) => METRICS[k].gearIndicator) as [MetricKey, ...MetricKey[]];

/** Metrics the monthly summaries carry. */
export const MONTHLY_METRIC_KEYS = METRIC_KEYS.filter((k) => !METRICS[k].districtsOnly) as [MetricKey, ...MetricKey[]];

/** Per-species metrics in `taxa_summaries`. */
export const TAXA_METRICS = catalogue({
  catch_kg: TOTAL,
  mean_length: AVERAGE,
  price_kg: AVERAGE,
});

export type TaxaMetricKey = keyof typeof TAXA_METRICS;
export const TAXA_METRIC_KEYS = Object.keys(TAXA_METRICS) as [TaxaMetricKey, ...TaxaMetricKey[]];

export const isMetricKey = (key: string): key is MetricKey => (METRIC_KEYS as string[]).includes(key);

/** Combine values by a rule. Null, undefined and NaN are skipped; nothing left gives null. */
export function combine(values: readonly (number | null | undefined)[], how: Combine): number | null {
  const valid = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!valid.length) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return how === "sum" ? sum : sum / valid.length;
}
