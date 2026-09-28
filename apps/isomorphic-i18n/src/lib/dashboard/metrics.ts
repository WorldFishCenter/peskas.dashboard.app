import type { RouterOutputs } from "@isomorphic/api";
import { confidenceBand, METRICS, type MetricKey } from "@repo/domain/metrics";
import { activeCountry } from "@/config/countryConfig";
import type { ChartText } from "@/components/charts/chart-card";

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

/**
 * An estimate resting on under 10% of boats tracked: its change on a year
 * earlier says more about which boats carried trackers than about the
 * fishery, so it is rounded to two figures and shows no change.
 */
export const isLowConfidenceEstimate = (
  metric: MetricKey,
  samplingRate: number | null | undefined,
) => !!METRICS[metric].estimated && confidenceBand(samplingRate) === "low";
