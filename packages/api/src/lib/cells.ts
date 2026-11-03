import {
  combine,
  comparable,
  METRIC_KEYS,
  METRICS,
  twinOf,
  type MetricKey,
} from "@repo/domain/metrics";
import { DistrictSummaryModel } from "@repo/nosql/schema/district-summary";
import { MonthlySummaryDistrictModel } from "@repo/nosql/schema/monthly-summary-district";
import { scopeDistricts } from "./country";

/*
 * How the summaries are read and combined across districts, months, gears and
 * taxa, the pages' rules in one place: the summaries procedures and AskFish's
 * combined figures (`askfish/combine.ts`) both use them.
 */

export const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/** `map.get(key)`, creating the entry with `make()` first when it is missing. */
export const entry = <K, V>(map: Map<K, V>, key: K, make: () => V) =>
  map.get(key) ?? map.set(key, make()).get(key)!;

/** The Mongo filter for some districts of the active country (all of them when left out) and dates. */
export const scopeMatch = (districts: string[] | undefined, date: object | null) => ({
  gaul_2_name: { $in: scopeDistricts(districts) },
  ...(date ? { date } : {}),
});

/** A metric's key, with its twin's for an estimate both methods make. */
export const withTwin = (metric: MetricKey) => {
  const twin = twinOf(metric);
  return twin ? [metric, twin] : [metric];
};

export const sum = (values: readonly (number | null | undefined)[]) => combine(values, "sum") ?? 0;

/** Indicator values of one district in one month. */
export type Cell = Record<string, number>;
/** month → district → indicator values. */
export type Cells = Map<string, Map<string, Cell>>;

/** Add summary docs' values to month → district → values, each under `field(doc)`. */
function addCells<D extends { gaul_2_name: string; date: Date; value?: number | null }>(
  cells: Cells,
  docs: D[],
  field: (d: D) => string,
) {
  for (const d of docs) {
    if (d.value == null) continue;
    entry(
      entry(cells, monthKey(d.date), () => new Map()),
      d.gaul_2_name,
      (): Cell => ({}),
    )[field(d)] = d.value;
  }
  return cells;
}

/** Read district summaries into month → district → indicator values. */
export async function districtCells(filter: object, indicators: string[]): Promise<Cells> {
  const docs = await DistrictSummaryModel.find({
    ...filter,
    indicator: { $in: indicators },
  }).lean();
  return addCells(new Map(), docs, (d) => d.indicator);
}

/** Read monthly summaries into month → district → values, with each district-month's landings. */
export async function monthlyCells(filter: object, metrics: string[]) {
  const [docs, landings] = await Promise.all([
    MonthlySummaryDistrictModel.find({ ...filter, metric: { $in: metrics } }).lean(),
    DistrictSummaryModel.find({ ...filter, indicator: "n_submissions" }).lean(),
  ]);
  const cells = addCells(
    addCells(new Map(), docs, (d) => d.metric),
    landings,
    (d) => d.indicator,
  );
  return { docs, cells };
}

/** Summary docs' values gathered per group and per cell (a district-month by default): group → cell → field → value. */
export function groupCells<D extends { gaul_2_name: string; date?: Date; value?: number | null }>(
  docs: D[],
  group: (d: D) => string | null,
  field: (d: D) => string,
  cell: (d: D) => string = (d) => `${d.gaul_2_name}|${d.date?.toISOString()}`,
) {
  const groups = new Map<string | null, Map<string, Cell>>();
  for (const d of docs) {
    if (d.value == null) continue;
    entry(
      entry(groups, group(d), () => new Map()),
      cell(d),
      (): Cell => ({}),
    )[field(d)] = d.value;
  }
  return groups;
}

/** Every cell of some months, as one list. */
export const cellsOf = (cells: Cells, months: string[]) =>
  months.flatMap((m) => [...(cells.get(m)?.values() ?? [])]);

/**
 * The cells of some months a metric adds up (`keep`, null for all of them):
 * for an estimate both methods make, the shared district-months (CONTEXT.md)
 * when there are any, which `shared` says.
 */
export function inTotals(cells: Cells, months: string[], metric: MetricKey) {
  const { cells: used, shared } = comparable(cellsOf(cells, months), metric);
  return { keep: shared ? new Set(used) : null, shared };
}

/**
 * One metric over the districts in one month (those in `keep`, or all), the
 * landings behind it, and how many districts it combines: a total covers only
 * those with a value.
 */
export function acrossDistricts(
  byDistrict: Map<string, Cell> | undefined,
  metric: MetricKey,
  keep: Set<Cell> | null,
) {
  const rows = [...(byDistrict?.values() ?? [])].filter((r) => !keep || keep.has(r));
  const landings = rows.map((r) => r.n_submissions);
  return {
    value: combine(
      rows.map((r) => r[metric]),
      METRICS[metric].overDistricts,
      landings,
    ),
    landings: sum(landings),
    districts: rows.filter((r) => r[metric] != null).length,
  };
}

/** Every metric of one district over the months in `cells`, each combined across months by its rule. */
export function districtMetrics(
  cells: Cells,
  district: string,
  keep: (month: string) => boolean = () => true,
) {
  const months = [...cells]
    .filter(([month]) => keep(month))
    .map(([, byDistrict]) => byDistrict.get(district))
    .filter((c): c is Cell => !!c);
  const used = Object.fromEntries(METRIC_KEYS.map((m) => [m, comparable(months, m)]));
  return {
    metrics: Object.fromEntries(
      METRIC_KEYS.map((m) => [
        m,
        combine(
          used[m].cells.map((c) => c[m]),
          METRICS[m].overMonths,
          used[m].cells.map((c) => c.n_submissions),
        ),
      ]),
    ) as Record<MetricKey, number | null>,
    /** Whether each metric added up only the months both methods estimate. */
    shared: Object.fromEntries(METRIC_KEYS.map((m) => [m, used[m].shared])) as Record<
      MetricKey,
      boolean
    >,
    samplingRate: combine(
      months.map((c) => c.sampling_rate),
      "mean",
    ),
  };
}

/** One metric over some districts and months: districts combined per month, then the months. */
export function overWindow(cells: Cells, months: string[], metric: MetricKey) {
  const { keep, shared } = inTotals(cells, months, metric);
  const perMonth = months.map((month) => ({
    month,
    ...acrossDistricts(cells.get(month), metric, keep),
  }));
  return {
    value: combine(
      perMonth.map((p) => p.value),
      METRICS[metric].overMonths,
      perMonth.map((p) => p.landings),
    ),
    perMonth,
    /** Whether it added up only the district-months both methods estimate. */
    shared,
    /** The district-months with a value behind it. */
    covered: sum(perMonth.map((p) => p.districts)),
  };
}
