/**
 * Every metric the portal summaries carry and how its values combine (see
 * Metric, Total metric and Average metric in CONTEXT.md). Labels, units and
 * explanations stay in the app's locale files as
 * `metric-<key>-{title,unit,desc,how,limits}`; this module only knows the keys.
 */

/** Summed (a Total metric) or averaged, weighted by landings (an Average metric). */
export type Combine = "sum" | "mean";

type MetricSpec<K extends string> = {
  overMonths: Combine;
  overDistricts: Combine;
  /** The same measure's name in the gear summaries. */
  gearIndicator?: "cpue" | "rpue";
  /** Only in the district summaries: the monthly summaries don't carry it. */
  districtsOnly?: true;
  /** Scaled up from the surveyed landings to the district's fleet, rather than recorded. */
  estimated?: true;
  /** Raised with the FAO ARTFISH method rather than the GPS tracker method (see CONTEXT.md). */
  artfish?: true;
  /** The same estimate by the other method. */
  twin?: K;
};

const TOTAL = { overMonths: "sum", overDistricts: "sum" } as const;
const AVERAGE = { overMonths: "mean", overDistricts: "mean" } as const;

const catalogue = <K extends string>(specs: Record<K, MetricSpec<NoInfer<K>>>) => specs;

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
  estimated_fishing_trips: { ...TOTAL, estimated: true, twin: "estimated_fishing_trips_fao" },
  estimated_revenue: { ...TOTAL, estimated: true, twin: "estimated_revenue_fao" },
  estimated_catch_tn: { ...TOTAL, estimated: true, twin: "estimated_catch_tn_fao" },
  estimated_fishing_trips_fao: {
    ...TOTAL,
    estimated: true,
    artfish: true,
    twin: "estimated_fishing_trips",
  },
  estimated_revenue_fao: { ...TOTAL, estimated: true, artfish: true, twin: "estimated_revenue" },
  estimated_catch_tn_fao: { ...TOTAL, estimated: true, artfish: true, twin: "estimated_catch_tn" },
});

export type MetricKey = keyof typeof METRICS;
export const METRIC_KEYS = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];

/** The same estimate by the other method, for an estimated figure both methods make. */
export const twinOf = (metric: MetricKey): MetricKey | undefined => METRICS[metric].twin;

/** The two methods an estimate is made by (CONTEXT.md). */
export type Method = "tracker" | "artfish";
export const METHODS: readonly Method[] = ["tracker", "artfish"];

export const methodOf = (metric: MetricKey): Method =>
  METRICS[metric].artfish ? "artfish" : "tracker";

/** Each estimate both methods make as each method's key, built once so it is stable across calls. */
const KEYS_BY_METRIC = Object.fromEntries(
  METRIC_KEYS.flatMap((m) => {
    const twin = twinOf(m);
    if (!twin) return [];
    return [
      [m, METRICS[m].artfish ? { tracker: twin, artfish: m } : { tracker: m, artfish: twin }],
    ];
  }),
) as Partial<Record<MetricKey, Record<Method, MetricKey>>>;

/** An estimate both methods make as each method's key; null for any other metric. */
export const methodKeys = (metric: MetricKey) => KEYS_BY_METRIC[metric] ?? null;

/**
 * The district-months to add up for a metric both methods estimate: only
 * those both estimate (`shared`), so the two totals compare like with like.
 * Where the two share none of them, each keeps its own: one alone, or both
 * side by side with nothing to compare.
 */
export function comparable<C extends Partial<Record<MetricKey, number | null>>>(
  cells: C[],
  metric: MetricKey,
): { cells: C[]; shared: boolean } {
  const twin = twinOf(metric);
  const both = twin ? cells.filter((c) => c[metric] != null && c[twin] != null) : [];
  return both.length ? { cells: both, shared: true } : { cells, shared: false };
}

/**
 * How many district-months both methods estimate, and how many only one does,
 * which `comparable` then leaves out of both totals (none when nothing is shared).
 */
export function methodCoverage(
  cells: Partial<Record<MetricKey, number | null>>[],
  metric: MetricKey,
) {
  const twin = twinOf(metric);
  const { cells: both, shared } = comparable(cells, metric);
  if (!twin || !shared) return { shared: 0, unshared: 0 };
  const unshared = cells.filter((c) => (c[metric] != null) !== (c[twin] != null)).length;
  return { shared: both.length, unshared };
}

/**
 * Why an estimate shows no change on a year earlier, if it doesn't: an FAO
 * ARTFISH one never does; a GPS tracker one while under 10% of boats are
 * tracked, when the change says more about which boats carried trackers than
 * about the fishery.
 * ponytail: ARTFISH never shows a change; give it its own confidence once coasts publishes its precision.
 */
export function changeHidden(
  metric: MetricKey,
  samplingRate: number | null | undefined,
): "artfish" | "low" | null {
  if (!METRICS[metric].estimated) return null;
  if (METRICS[metric].artfish) return "artfish";
  return confidenceBand(samplingRate) === "low" ? "low" : null;
}

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
