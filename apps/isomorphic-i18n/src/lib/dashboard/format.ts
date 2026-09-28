import { activeCountry } from "@/config/countryConfig";

/** Numbers follow the page language as spoken in the country, e.g. `pt-MZ` ("61,9 mil milhões"). */
export const numberLocale = (lang: string) => `${lang}-${activeCountry.countryCode}`;

const valid = (value: unknown): value is number | string =>
  value !== null && value !== undefined && value !== "" && !isNaN(Number(value));

/**
 * A figure to read: whole numbers from 1,000, one decimal below, and millions
 * or more in words ("61.9 billion", "bilioni 61.9"). A decimal on
 * "139,730.3 trips" is precision the estimates don't have.
 */
export function formatNumber(value: unknown, lang: string = activeCountry.languages[0]) {
  if (!valid(value)) return "-";
  const n = Number(value);
  const locale = numberLocale(lang);
  if (Math.abs(n) >= 1_000_000) {
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      compactDisplay: "long",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return n.toLocaleString(locale, { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 1 });
}

/** An axis tick: short and compact ("500K", "1.2M", "500 mil"). */
export const formatTick = (value: number, lang: string) =>
  new Intl.NumberFormat(numberLocale(lang), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

/** An estimated total to two significant figures, which is all it can bear ("16,000", "62 billion"). */
export function formatApprox(value: unknown, lang: string) {
  if (!valid(value)) return "-";
  return new Intl.NumberFormat(numberLocale(lang), {
    notation: Math.abs(Number(value)) >= 1_000_000 ? "compact" : "standard",
    compactDisplay: "long",
    maximumSignificantDigits: 2,
  }).format(Number(value));
}

/** Label for a `YYYY-MM` month in the page language, e.g. "Jul 26" or "July 2026". */
export const monthLabel = (month: string, lang: string, style: "short" | "long" = "short") =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(lang, {
    month: style,
    year: style === "short" ? "2-digit" : "numeric",
    timeZone: "UTC",
  });

/** A span of months in the page language, e.g. "Mar – Aug 2026" or "Apr 2025 – Aug 2026". */
export const monthSpan = (start: string, end: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { month: "short", year: "numeric", timeZone: "UTC" }).formatRange(
    new Date(`${start}-01T00:00:00Z`),
    new Date(`${end}-01T00:00:00Z`),
  );

/** A time series' month (`YYYY-MM`) axis. */
export const monthAxis = (lang: string) => ({
  dataKey: "month",
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 30,
  tickFormatter: (v: string) => monthLabel(v, lang),
});

/** A time series' tooltip heading: the hovered month in full. */
export const monthTooltipLabel =
  (lang: string) => (_label: unknown, payload: readonly { payload?: { month?: unknown } }[]) =>
    monthLabel(String(payload?.[0]?.payload?.month), lang, "long");

/** Name of a calendar month (1–12) in the page language, e.g. "Jul". */
export const calendarMonthLabel = (month: number, lang: string) =>
  new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString(lang, {
    month: "short",
    timeZone: "UTC",
  });

/** Shorten a long axis label, e.g. a species name, to `max` characters plus "...". */
export const truncateLabel = (s: string, max = 15) =>
  s.length > max ? `${s.slice(0, max)}...` : s;

/** A gear as coasts names it (`gill_net`, `hand line`), in title case; `fallback` for trips without one. */
export const gearLabel = (gear: string | null, fallback: string) =>
  gear
    ? gear
        .replace(/_/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : fallback;

/** A percentage with no decimals below 100 and one under 10, e.g. "7.5%" or "42%". */
export const formatPercent = (value: number | null | undefined, lang: string) =>
  value == null
    ? "-"
    : `${value.toLocaleString(numberLocale(lang), { maximumFractionDigits: value < 10 ? 1 : 0 })}%`;

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "1,234 landings", in the page language. */
export const landingsCount = (t: Translate, lang: string, n: number) =>
  t("text-landings-count", { count: n, formatted: n.toLocaleString(numberLocale(lang)) });

/** A share known between two bounds (0–1) as text: "94%" when they round alike, else "94% to 95%". */
export function shareRange(
  t: Translate,
  lang: string,
  share: { least: number; most: number } | null,
) {
  if (!share) return "-";
  const [least, most] = [
    formatPercent(100 * share.least, lang),
    formatPercent(100 * share.most, lang),
  ];
  return least === most ? least : t("text-share-range", { least, most });
}
