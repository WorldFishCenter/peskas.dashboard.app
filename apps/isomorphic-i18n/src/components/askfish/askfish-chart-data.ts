/**
 * Presentation-only transformations for AskFish charts.
 * No fisheries indicators or missing observations are calculated here.
 */
export type ChartBarPoint = {
  x: string | number;
  y: number;
  label?: string | null;
};
export type ChartBarSeries = { name: string; points: readonly ChartBarPoint[] };
export type GroupedBarRow = { category: string } & Record<string, string | number | null>;

/**
 * Keep zero visible, but include the entire signed data range.
 * This avoids cutting off losses and decreases while retaining the dashboard's
 * familiar zero baseline for ordinary nonnegative indicator charts.
 */
export function valueAxisDomain(values: readonly number[]): [number, number] {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return [0, 1];
  const low = Math.min(0, ...valid);
  const high = Math.max(0, ...valid);
  if (low === 0 && high === 0) return [-1, 1];
  const span = Math.max(high - low, Math.abs(low), Math.abs(high));
  const padding = span * 0.05;
  return [low < 0 ? low - padding : 0, high > 0 ? high + padding : 0];
}

/**
 * Match bar categories across series by the exact x label, never by position.
 * A missing category stays null (not an invented zero). Duplicate category
 * observations in a series are a contract error and are not silently merged.
 */
export function groupedBarRows(series: readonly ChartBarSeries[]): GroupedBarRow[] | null {
  if (!series.length) return [];
  const labels: string[] = [];
  const seenLabels = new Set<string>();
  const lookups = series.map((s) => {
    const values = new Map<string, number>();
    for (const p of s.points) {
      const key = String(p.x);
      if (values.has(key) || !Number.isFinite(p.y)) return null;
      values.set(key, p.y);
      if (!seenLabels.has(key)) {
        seenLabels.add(key);
        labels.push(key);
      }
    }
    return values;
  });
  if (lookups.some((v) => v === null)) return null;
  return labels.map((category) => {
    const row: GroupedBarRow = { category };
    lookups.forEach((lookup, i) => {
      row[`s${i}`] = lookup?.get(category) ?? null;
    });
    return row;
  });
}

const ENDPOINT_LABEL = /^(.*?)\s+·\s+(\d{4}-\d{2}(?:-\d{2})?)$/;

/**
 * Convert one flat baseline/target series with paired group/date labels into
 * two side-by-side bar series, only when every group has exactly two matching
 * dates. Do not guess from partial labels or silently fill missing endpoints.
 *
 * Input:  "Kusini · 2026-01-01" / "Kusini · 2026-09-01"
 * Output: Jan and Sep series with category "Kusini".
 */
export function pairedEndpointSeries(series: ChartBarSeries): ChartBarSeries[] | null {
  const rows: { group: string; date: string; y: number }[] = [];
  const dates = new Set<string>();
  const groups = new Set<string>();
  const unique = new Set<string>();
  for (const p of series.points) {
    const match = ENDPOINT_LABEL.exec(String(p.x));
    if (!match || !match[1]?.trim() || !Number.isFinite(p.y)) return null;
    const group = match[1].trim();
    const date = match[2]!;
    const key = `${group}\u0000${date}`;
    if (unique.has(key)) return null;
    unique.add(key);
    groups.add(group);
    dates.add(date);
    rows.push({ group, date, y: p.y });
  }
  if (!groups.size || dates.size !== 2 || rows.length !== groups.size * 2) return null;
  const orderedDates = [...dates].sort();
  for (const group of groups) {
    if (orderedDates.some((date) => !unique.has(`${group}\u0000${date}`))) return null;
  }
  return orderedDates.map((date) => ({
    name: date,
    points: rows.filter((row) => row.date === date).map((row) => ({ x: row.group, y: row.y })),
  }));
}

/** District-by-month display with explicit missing cells and no arithmetic.
 * Every source observation must have a unique (series, month) key.
 */
export type HeatmapRow = { name: string; values: (number | null)[] };
export type HeatmapGrid = { periods: string[]; rows: HeatmapRow[]; min: number; max: number };

export function heatmapGrid(series: readonly ChartBarSeries[]): HeatmapGrid | null {
  if (!series.length || series.length > 30) return null;
  const monthSet = new Set<string>();
  const observed: number[] = [];
  const lookups = series.map((s) => {
    const values = new Map<string, number>();
    for (const point of s.points) {
      const month = String(point.x);
      if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(month) || !Number.isFinite(point.y) || values.has(month))
        return null;
      values.set(month, point.y);
      observed.push(point.y);
      monthSet.add(month);
    }
    return values;
  });
  if (
    lookups.some((lookup) => lookup === null) ||
    !observed.length ||
    monthSet.size > 36 ||
    new Set(series.map((s) => s.name)).size !== series.length
  )
    return null;
  const periods = [...monthSet].sort();
  return {
    periods,
    rows: series.map((s, i) => ({
      name: s.name,
      values: periods.map((month) => lookups[i]?.get(month) ?? null),
    })),
    min: Math.min(...observed),
    max: Math.max(...observed),
  };
}
