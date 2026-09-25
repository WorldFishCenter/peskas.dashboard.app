import Script from 'next/script';

import { activeCountry } from '@/config/countryConfig';

/**
 * Google Analytics 4 (gtag.js).
 *
 * Each country deploys as its own Vercel project, so NEXT_PUBLIC_GA_MEASUREMENT_ID
 * is set per deployment and points at that country's GA4 data stream. Leaving it
 * unset (local dev, preview deployments) renders nothing, which keeps non-production
 * traffic out of the reporting property.
 *
 * NEXT_PUBLIC_GA_ROLLUP_ID is optional and shared by every deployment: when set,
 * gtag mirrors every event to that second property to give a platform-wide view
 * across all countries. See ANALYTICS.md for the GA4 admin setup.
 */
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const rollupMeasurementId = process.env.NEXT_PUBLIC_GA_ROLLUP_ID;

export default function GoogleAnalytics() {
  if (!measurementId) return null;

  const destinations = rollupMeasurementId
    ? [measurementId, rollupMeasurementId]
    : [measurementId];

  // Attached to every event so a single property can be broken down by country.
  // Register both as event-scoped custom dimensions in GA4 to use them in reports.
  const globalParams = {
    peskas_country: activeCountry.countryName,
    peskas_country_code: activeCountry.countryCode,
  };

  // gtag('set') must precede gtag('config') so the automatic first page_view
  // carries the country params. No page_view is sent on route change here:
  // GA4 enhanced measurement tracks App Router navigations via History API
  // events, and firing our own would double-count every navigation.
  const initScript = [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js', new Date());",
    `gtag('set', ${JSON.stringify(globalParams)});`,
    ...destinations.map((id) => `gtag('config', ${JSON.stringify(id)});`),
  ].join('\n');

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: initScript }}
      />
    </>
  );
}
