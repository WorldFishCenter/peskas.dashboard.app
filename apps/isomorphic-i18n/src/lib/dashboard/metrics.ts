import { CURRENCY_CODE } from '@/config/constants';

/**
 * Every indicator the district summaries carry. Labels, units and
 * descriptions live in the locale files as `metric-<key>-{title,unit,desc}`.
 */
export const METRIC_KEYS = [
  'mean_cpue',
  'mean_rpue',
  'n_fishers',
  'n_submissions',
  'trip_duration_hrs',
  'mean_price_kg',
  'estimated_revenue',
  'estimated_catch_tn',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

/**
 * Metrics that are totals: the server sums them across districts, and the
 * dashboard labels their axes "aggregated". Every other metric is a mean.
 */
export const SUM_METRICS: ReadonlySet<string> = new Set<MetricKey>([
  'n_submissions',
  'estimated_catch_tn',
  'estimated_revenue',
]);

/** Options offered by the header metric selector on each analysis page. */
export const CATCH_PAGE_METRICS: MetricKey[] = ['mean_cpue', 'estimated_catch_tn'];
export const REVENUE_PAGE_METRICS: MetricKey[] = ['mean_rpue', 'estimated_revenue'];

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const metricTitle = (t: Translate, metric: string) => t(`metric-${metric}-title`);

/** Unit string for a metric, or "" when the metric has none. */
export const metricUnit = (t: Translate, metric: string) =>
  t(`metric-${metric}-unit`, { currency: CURRENCY_CODE });

export const metricDescription = (t: Translate, metric: string) => t(`metric-${metric}-desc`);
