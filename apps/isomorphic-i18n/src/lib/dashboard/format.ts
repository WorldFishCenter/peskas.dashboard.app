import { activeCountry } from '@/config/countryConfig';
import { isMetricKey, METRICS } from '@repo/domain/metrics';

export function formatDashboardNumber(value: unknown, metric?: string, lang: string = activeCountry.locale) {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  const n = Number(value);
  if (metric && isMetricKey(metric) && METRICS[metric].inMillions) {
    return (n / 1_000_000).toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 0 }) + 'M';
  }
  if (Math.abs(n) >= 1_000_000) {
    return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(n);
  }
  return n.toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

/** Label for a `YYYY-MM` month in the page language, e.g. "Jul 26" or "July 2026". */
export const monthLabel = (month: string, lang: string, style: 'short' | 'long' = 'short') =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(lang, {
    month: style,
    year: style === 'short' ? '2-digit' : 'numeric',
    timeZone: 'UTC',
  });

/** Name of a calendar month (1–12) in the page language, e.g. "Jul". */
export const calendarMonthLabel = (month: number, lang: string) =>
  new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString(lang, { month: 'short', timeZone: 'UTC' });

/** Shorten a long axis label, e.g. a species name, to `max` characters plus "...". */
export const truncateLabel = (s: string, max = 15) => (s.length > max ? `${s.slice(0, max)}...` : s);
