import { activeCountry } from '@/config/countryConfig';
import type { ChartText } from '@/components/charts/chart-card';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const currency = { currency: activeCountry.currencyCode };

export const metricTitle = (t: Translate, metric: string) => t(`metric-${metric}-title`);

/** Unit string for a metric, or "" when the metric has none. */
export const metricUnit = (t: Translate, metric: string) => t(`metric-${metric}-unit`, currency);

export const metricDescription = (t: Translate, metric: string) => t(`metric-${metric}-desc`, currency);

/** What a metric shows, how coasts calculates it and its limits, for the chart explanations. */
export const metricInfo = (t: Translate, metric: string): ChartText => ({
  what: metricDescription(t, metric),
  how: t(`metric-${metric}-how`, currency),
  limits: t(`metric-${metric}-limits`, currency),
});

/** Catch by species, with the survey's sampling where the country's survey identifies only a sample. */
export const compositionInfo = (t: Translate): ChartText => ({
  what: t('info-composition-what'),
  how: t('info-composition-how'),
  limits: [t('info-composition-limits'), activeCountry.survey.speciesFromSample && t('info-composition-limits-sample')]
    .filter(Boolean)
    .join(' '),
});

/** Species prices, explained for a survey that prices each species or one that values the whole trip. */
export const speciesPriceInfo = (t: Translate): ChartText => ({
  what: t('info-species-price-what'),
  how: t(activeCountry.survey.pricedBySpecies ? 'info-species-price-how-species' : 'info-species-price-how-trip'),
  limits: t('info-species-price-limits'),
});
