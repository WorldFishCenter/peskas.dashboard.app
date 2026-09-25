import { LOCALE } from '@/config/constants';
import { SUM_METRICS } from '@/lib/dashboard/metrics';

export function formatDashboardNumber(value: unknown, metric?: string, lang: string = LOCALE) {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  const n = Number(value);
  if (metric === 'estimated_revenue') {
    return (n / 1_000_000).toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 0 }) + 'M';
  }
  if (Math.abs(n) >= 1_000_000) {
    return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(n);
  }
  return n.toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

/**
 * The query window for a time range. Both ends are rounded to whole days so
 * every component asking for the same range shares one tRPC cache entry.
 */
export function computeDateRange(range: string | number): { start: string; end: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (range === 'all') return { start: '1900-01-01', end: end.toISOString() };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - Number(range));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Sum metrics are summed, everything else averaged; nulls and NaN are ignored. */
export function getAggregatedDistrictValue(row: Record<string, unknown>, metric: string) {
  const raw = row[metric];
  const values = (Array.isArray(raw) ? raw : [raw]).filter(
    (v): v is number => typeof v === 'number' && !isNaN(v)
  );
  if (!values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return SUM_METRICS.has(metric) ? sum : sum / values.length;
}

/** Shorten a long axis label, e.g. a species name, to `max` characters plus "...". */
export const truncateLabel = (s: string, max = 15) => (s.length > max ? `${s.slice(0, max)}...` : s);
