/**
 * Client-side wrapper for GA4 custom events.
 *
 * No-ops when gtag is absent, which is the case in local development and on preview
 * deployments: vite.config.ts only injects the tag when
 * VITE_GA_MEASUREMENT_ID is set. Callers never pass the country — the init
 * snippet attaches peskas_country to every event globally.
 *
 * Each event parameter must be registered as a custom dimension in GA4 before it
 * shows up in reports, and GA4 does not backfill. See ANALYTICS.md.
 */

/** GA4 event names must be snake_case and 40 characters or fewer. */
export type AnalyticsEvent =
  | 'filter_time_range_change'
  | 'filter_metric_change'
  | 'filter_district_change'
  | 'map_basemap_change'
  | 'map_effort_range_toggle';

type AnalyticsParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (
      command: 'event',
      eventName: string,
      params?: AnalyticsParams
    ) => void;
  }
}

export function trackEvent(event: AnalyticsEvent, params?: AnalyticsParams) {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', event, params);
}
