import type { MetricKey } from '@repo/domain/metrics';
import { activeCountry } from '@/config/countryConfig';

/** Options offered by the header metric selector on each analysis page. */
export const CATCH_PAGE_METRICS: MetricKey[] = ['mean_cpue', 'estimated_catch_tn'];
export const REVENUE_PAGE_METRICS: MetricKey[] = ['mean_rpue', 'estimated_revenue'];

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const metricTitle = (t: Translate, metric: string) => t(`metric-${metric}-title`);

/** Unit string for a metric, or "" when the metric has none. */
export const metricUnit = (t: Translate, metric: string) =>
  t(`metric-${metric}-unit`, { currency: activeCountry.currencyCode });

export const metricDescription = (t: Translate, metric: string) => t(`metric-${metric}-desc`);
