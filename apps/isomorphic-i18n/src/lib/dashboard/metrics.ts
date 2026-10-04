import type { RouterOutputs } from "@isomorphic/api";
import {
  methodKeys,
  methodOf,
  METHODS,
  METRICS,
  twinOf,
  type Method,
  type MetricKey,
} from "@repo/domain/metrics";
import { activeCountry } from "@/config/countryConfig";
import type { ChartText } from "@/components/charts/chart-card";
import { formatApprox, formatNumber } from "@/lib/dashboard/format";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const currency = { currency: activeCountry.currencyCode };

export const metricTitle = (t: Translate, metric: string) => t(`metric-${metric}-title`);

/** Unit string for a metric, or "" when the metric has none. */
export const metricUnit = (t: Translate, metric: string) => t(`metric-${metric}-unit`, currency);

export const metricDescription = (t: Translate, metric: string) =>
  t(`metric-${metric}-desc`, currency);

/** What a metric shows, how coasts calculates it and its limits, for the chart explanations. */
export const metricInfo = (t: Translate, metric: string): ChartText => ({
  what: metricDescription(t, metric),
  how: t(`metric-${metric}-how`, currency),
  limits: t(`metric-${metric}-limits`, currency),
});

/** Catch by species, with the survey's sampling where the country's survey identifies only a sample. */
export const compositionInfo = (t: Translate): ChartText => ({
  what: t("info-composition-what"),
  how: t("info-composition-how"),
  limits: [
    t("info-composition-limits"),
    activeCountry.survey.speciesFromSample && t("info-composition-limits-sample"),
  ]
    .filter(Boolean)
    .join(" "),
});

/** Species prices, explained for a survey that prices each species or one that values the whole trip. */
export const speciesPriceInfo = (t: Translate): ChartText => ({
  what: t("info-species-price-what"),
  how: t(
    activeCountry.survey.pricedBySpecies
      ? "info-species-price-how-species"
      : "info-species-price-how-trip",
  ),
  limits: t("info-species-price-limits"),
});

export type Headline = NonNullable<RouterOutputs["summaries"]["headline"]>;

/** The figures measured on the surveyed landings, in reading order. */
export const RECORDED: MetricKey[] = [
  "mean_cpue",
  "mean_catch_kg",
  "mean_catch_price",
  "n_submissions",
];
/** The totals scaled up to every boat. */
export const ESTIMATED: MetricKey[] = [
  "estimated_catch_tn",
  "estimated_revenue",
  "estimated_fishing_trips",
];

/** Whether a headline has anything to compare with a year earlier. */
export const hasComparison = (data: Headline) =>
  data.previous != null && RECORDED.some((m) => data.metrics[m].previous != null);

/** Percent change from `previous` to `value`; null when there is nothing to compare with. */
export function yearChange(value: number | null | undefined, previous: number | null | undefined) {
  if (value == null || previous == null || previous === 0) return null;
  return ((value - previous) / Math.abs(previous)) * 100;
}

/** A metric's value as the dashboard shows it: every estimate, by either method, rounded with ≈. */
export const formatValue = (metric: MetricKey, value: number | null | undefined, lang: string) =>
  value != null && METRICS[metric].estimated
    ? `≈${formatApprox(value, lang)}`
    : formatNumber(value, lang);

/** The methods with any value in `rows` (district rows, months of one district): none for other metrics. */
export function methodsWithData(
  metric: MetricKey,
  rows: Partial<Record<MetricKey, number | null>>[],
): Method[] {
  const keys = methodKeys(metric);
  return keys ? METHODS.filter((m) => rows.some((r) => r[keys[m]] != null)) : [];
}

/**
 * Order by the first figure, largest first, then by the second: rows only the
 * second method estimates come after the others, as in the district ranking.
 */
export const byFigures = (
  a: readonly (number | null | undefined)[],
  b: readonly (number | null | undefined)[],
) => (b[0] ?? -1) - (a[0] ?? -1) || (b[1] ?? 0) - (a[1] ?? 0);

/** "Estimated catch · ARTFISH" for an estimate both methods make, where the two sit side by side. */
export const methodTitle = (t: Translate, metric: MetricKey) =>
  twinOf(metric)
    ? `${metricTitle(t, metric)} · ${t(`text-method-${methodOf(metric)}-short`)}`
    : metricTitle(t, metric);

/** Each method's line colour, the same in every chart and tile; neither is `--chart-1`, which recorded figures wear. */
export const METHOD_COLOR: Record<Method, string> = {
  tracker: "var(--tracker)",
  artfish: "var(--artfish)",
};

/** Each method's heat-table ramp, the `--<tint>-1…5` tokens; a recorded figure takes the portal's own `--tint-*`. */
export const METHOD_TINT: Record<Method, string> = {
  tracker: "tint-tracker",
  artfish: "tint-artfish",
};

/** An estimate both methods make, explained for both and for why they differ. */
export const estimateInfo = (t: Translate, metric: MetricKey): ChartText => {
  const keys = methodKeys(metric);
  if (!keys) return metricInfo(t, metric);
  return {
    what: metricDescription(t, keys.tracker),
    how: METHODS.map(
      (m) => `${t(`text-method-${m}`)}: ${t(`metric-${keys[m]}-how`, currency)}`,
    ).join(" "),
    limits: t("info-methods-limits"),
  };
};
