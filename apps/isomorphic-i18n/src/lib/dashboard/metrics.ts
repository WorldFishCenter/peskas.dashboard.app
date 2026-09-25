import { activeCountry } from '@/config/countryConfig';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const metricTitle = (t: Translate, metric: string) => t(`metric-${metric}-title`);

/** Unit string for a metric, or "" when the metric has none. */
export const metricUnit = (t: Translate, metric: string) =>
  t(`metric-${metric}-unit`, { currency: activeCountry.currencyCode });

export const metricDescription = (t: Translate, metric: string) => t(`metric-${metric}-desc`);
