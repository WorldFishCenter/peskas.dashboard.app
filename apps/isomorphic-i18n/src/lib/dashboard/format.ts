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
  // A decimal on "139,730.3 trips" or "5,732.3 tonnes" is precision the estimates don't have.
  return n.toLocaleString(lang, { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 1, minimumFractionDigits: 0 });
}

/** Label for a `YYYY-MM` month in the page language, e.g. "Jul 26" or "July 2026". */
export const monthLabel = (month: string, lang: string, style: 'short' | 'long' = 'short') =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(lang, {
    month: style,
    year: style === 'short' ? '2-digit' : 'numeric',
    timeZone: 'UTC',
  });

/** A time series' month (`YYYY-MM`) axis. */
export const monthAxis = (lang: string) => ({
  dataKey: 'month',
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 30,
  tickFormatter: (v: string) => monthLabel(v, lang),
});

/** A time series' tooltip heading: the hovered month in full. */
export const monthTooltipLabel =
  (lang: string) =>
  (_label: unknown, payload: readonly { payload?: { month?: unknown } }[]) =>
    monthLabel(String(payload?.[0]?.payload?.month), lang, 'long');

/** Name of a calendar month (1–12) in the page language, e.g. "Jul". */
export const calendarMonthLabel = (month: number, lang: string) =>
  new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString(lang, { month: 'short', timeZone: 'UTC' });

/** Shorten a long axis label, e.g. a species name, to `max` characters plus "...". */
export const truncateLabel = (s: string, max = 15) => (s.length > max ? `${s.slice(0, max)}...` : s);

/** A gear as coasts names it (`gill_net`, `hand line`), in title case; `fallback` for trips without one. */
export const gearLabel = (gear: string | null, fallback: string) =>
  gear
    ? gear
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    : fallback;

/** A percentage with no decimals below 100 and one under 10, e.g. "7.5%" or "42%". */
export const formatPercent = (value: number | null | undefined, lang: string) =>
  value == null ? '-' : `${value.toLocaleString(lang, { maximumFractionDigits: value < 10 ? 1 : 0 })}%`;
