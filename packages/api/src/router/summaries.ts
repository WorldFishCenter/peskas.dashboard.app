import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  combine,
  comparable,
  FEW_LANDINGS,
  METRIC_KEYS,
  METRICS,
  MONTHLY_METRIC_KEYS,
  TAXA_METRIC_KEYS,
  TAXA_METRICS,
  twinOf,
  methodCoverage,
  methodKeys,
  METHODS,
  type Method,
  VULNERABILITY_BANDS,
  vulnerabilityBand,
  type Combine,
  type MetricKey,
  type TaxaMetricKey,
  type VulnerabilityBand,
} from "@repo/domain/metrics";
import type { MeasuredCatch } from "@repo/domain/sizes";
import { DistrictSummaryModel } from "@repo/nosql/schema/district-summary";
import { GearSummaryDistrictModel } from "@repo/nosql/schema/gear-summary-district";
import { GearTaxaSummaryModel } from "@repo/nosql/schema/gear-taxa-summary";
import { LengthSummaryModel } from "@repo/nosql/schema/length-summary";
import { MonthlySummaryDistrictModel } from "@repo/nosql/schema/monthly-summary-district";
import { TaxaSummaryDistrictModel } from "@repo/nosql/schema/taxa-summary-district";
import { TaxaTraitsModel } from "@repo/nosql/schema/taxa-traits";
import { activeCountry } from "../lib/country";
import { createTRPCRouter, publicProcedure } from "../trpc";

/*
 * Portal summary queries. Every procedure takes the same scope (which
 * districts, which month window), combines values by the metric catalogue's
 * rules and returns typed rows in the dashboard's terms (`district`, `month`,
 * `taxon`). Coasts' column names stay in this file, so renaming one in
 * `export_portal` is fixed here and nowhere else. Averages across months,
 * districts or gears are weighted by the landings behind each value.
 */

/** A taxon's total and its share per group (district or gear), largest taxon first. */
export type CompositionRow = {
  taxon: string | null;
  total: number;
  groups: { group: string | null; value: number }[];
};

/** One month (`YYYY-MM`) with a value per district. */
export type MonthRow = { month: string; [series: string]: number | string | null };
/** One calendar month (1–12) with each district's mean across years. */
export type SeasonRow = { month: number; [district: string]: number | null };
export type DistrictRow = {
  district: string;
  sampling_rate: number | null;
  /** The same metrics over the same months a year earlier; null for all time. */
  previous: Record<MetricKey, number | null> | null;
} & Record<MetricKey, number | null>;
// Coasts leaves some catches without a taxon and some trips without a gear: those come back as null.
// Coasts writes the scientific name as the taxon.
export type TaxonRow = { district: string; taxon: string | null } & Partial<
  Record<TaxaMetricKey, number>
>;

const scope = z.object({
  /** Districts of the active country; all of them when left out, none when empty. */
  districts: z.array(z.string()).optional(),
  /** The last `months` complete months; all of them when left out. The current month is never in. */
  months: z.number().int().positive().optional(),
});
type Scope = z.infer<typeof scope>;

/** First day (UTC) of the month `by` months from `date`'s. Summaries are dated on the 1st, in UTC. */
const addMonths = (date: Date, by: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + by, 1));

/**
 * First day (UTC) of the current month, where every window ends (excluded):
 * its landings are still coming in, so it would read as a drop.
 */
const thisMonth = () => addMonths(new Date(), 0);

/** First day (UTC) of the window's earliest month: `months` complete months back. */
const windowStart = (months: number) => addMonths(thisMonth(), -months);

const monthKey = (date: Date) => date.toISOString().slice(0, 7);
const monthDate = (key: string) => new Date(`${key}-01T00:00:00Z`);

/** Every month key from `start` to `end`, both included. */
function monthRange(start: string, end: string) {
  const keys: string[] = [];
  for (let d = monthDate(start); monthKey(d) <= end; d = addMonths(d, 1)) keys.push(monthKey(d));
  return keys;
}

/** Districts in scope, checked against the active country. */
function scopeDistricts(districts?: string[]) {
  const known = activeCountry().districts;
  const unknown = districts?.filter((d) => !known.includes(d)) ?? [];
  if (unknown.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Unknown districts: ${unknown.join(", ")}`,
    });
  }
  return districts ?? known;
}

/** The Mongo filter for a scope. */
function match({ districts, months }: Scope) {
  return {
    gaul_2_name: { $in: scopeDistricts(districts) },
    date: { ...(months ? { $gte: windowStart(months) } : {}), $lt: thisMonth() },
  };
}

/** `map.get(key)`, creating the entry with `make()` first when it is missing. */
const entry = <K, V>(map: Map<K, V>, key: K, make: () => V) =>
  map.get(key) ?? map.set(key, make()).get(key)!;

/** The Mongo accumulator for a combine rule. */
const accumulate = (how: Combine) => (how === "sum" ? { $sum: "$value" } : { $avg: "$value" });

const sum = (values: readonly (number | null | undefined)[]) => combine(values, "sum") ?? 0;

/** Indicator values of one district in one month. */
type Cell = Record<string, number>;
/** month → district → indicator values. */
type Cells = Map<string, Map<string, Cell>>;

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
async function districtCells(filter: object, indicators: string[]): Promise<Cells> {
  const docs = await DistrictSummaryModel.find({
    ...filter,
    indicator: { $in: indicators },
  }).lean();
  return addCells(new Map(), docs, (d) => d.indicator);
}

/** Summary docs' values gathered per group and per district-month: group → "district|month" → field → value. */
function groupCells<D extends { gaul_2_name: string; date?: Date; value?: number | null }>(
  docs: D[],
  group: (d: D) => string | null,
  field: (d: D) => string,
) {
  const groups = new Map<string | null, Map<string, Cell>>();
  for (const d of docs) {
    if (d.value == null) continue;
    const cell = entry(
      entry(groups, group(d), () => new Map()),
      `${d.gaul_2_name}|${d.date?.toISOString()}`,
      (): Cell => ({}),
    );
    cell[field(d)] = d.value;
  }
  return groups;
}

/** Taxon → a length trait, for the taxa that have it. */
const lengthsOf = <T extends { catch_taxon: string }>(traits: T[], key: keyof T) =>
  Object.fromEntries(
    traits.filter((t) => Number(t[key]) > 0).map((t) => [t.catch_taxon, Number(t[key])]),
  ) as Record<string, number>;

/** A metric's key, with its twin's for an estimate both methods make. */
const withTwin = (metric: MetricKey) => {
  const twin = twinOf(metric);
  return twin ? [metric, twin] : [metric];
};

/** Every cell of some months, as one list. */
const cellsOf = (cells: Cells, months: string[]) =>
  months.flatMap((m) => [...(cells.get(m)?.values() ?? [])]);

/**
 * The cells of some months a metric adds up (`keep`, null for all of them):
 * for an estimate both methods make, the shared district-months (CONTEXT.md)
 * when there are any, which `shared` says.
 */
function inTotals(cells: Cells, months: string[], metric: MetricKey) {
  const { cells: used, shared } = comparable(cellsOf(cells, months), metric);
  return { keep: shared ? new Set(used) : null, shared };
}

/** A year earlier's figure, when it was added up the same way as the window's: shared months both times or neither. */
const sameBasis = (value: number | null, sharedNow: boolean, sharedBefore: boolean) =>
  sharedNow === sharedBefore ? value : null;

/** One metric over the districts in one month (those in `keep`, or all), and the landings behind it. */
function acrossDistricts(
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
  };
}

/** Every metric of one district over the months in `cells`, each combined across months by its rule. */
function districtMetrics(
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
function overWindow(cells: Cells, months: string[], metric: MetricKey) {
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
  };
}

const monthlyMetric = scope.extend({ metric: z.enum(MONTHLY_METRIC_KEYS) });

const warned = new Set<string>();
/** Log each unlisted district once per server process, where whoever maintains the registry will see it. */
function warnUnlisted(districts: string[]) {
  const fresh = districts.filter((d) => !warned.has(d));
  if (!fresh.length) return;
  fresh.forEach((d) => warned.add(d));
  console.warn(
    `Landings in districts missing from ${activeCountry().countryCode}'s registry (packages/domain/src/country.ts): ${fresh.join(", ")}`,
  );
}

export const summariesRouter = createTRPCRouter({
  /**
   * Every metric per district over the window, each combined across months by
   * its rule, the mean share of the fleet tracked behind the estimates, and the
   * same metrics over the same months a year earlier.
   */
  byDistrict: publicProcedure.input(scope).query(async ({ input }): Promise<DistrictRow[]> => {
    const { districts, months } = input;
    const start = months ? windowStart(months) : null;
    const cells = await districtCells(
      {
        ...match({ districts }),
        ...(start ? { date: { $gte: addMonths(start, -12), $lt: thisMonth() } } : {}),
      },
      [...METRIC_KEYS, "sampling_rate"],
    );
    const inWindow = (month: string) => !start || month >= monthKey(start);
    const yearEarlier = (month: string) => !!start && month < monthKey(addMonths(thisMonth(), -12));
    return scopeDistricts(districts).map((district) => {
      const now = districtMetrics(cells, district, inWindow);
      const before = start ? districtMetrics(cells, district, yearEarlier) : null;
      return {
        district,
        ...now.metrics,
        sampling_rate: now.samplingRate,
        previous:
          before &&
          (Object.fromEntries(
            METRIC_KEYS.map((m) => [
              m,
              sameBasis(before.metrics[m], now.shared[m], before.shared[m]),
            ]),
          ) as Record<MetricKey, number | null>),
      };
    });
  }),

  /**
   * The scope's figures over the window (all of it when `months` is left out),
   * against the same months a year earlier, and month by month.
   */
  headline: publicProcedure.input(scope).query(async ({ input }) => {
    const end = monthKey(addMonths(thisMonth(), -1));
    const start = input.months
      ? monthKey(addMonths(monthDate(end), -(input.months - 1)))
      : undefined;
    const from = start ? monthKey(addMonths(monthDate(start), -12)) : undefined;

    const cells = await districtCells(
      {
        ...match({ districts: input.districts }),
        date: { ...(from ? { $gte: monthDate(from) } : {}), $lte: monthDate(end) },
      },
      [...METRIC_KEYS, "sampling_rate"],
    );
    const first = [...cells.keys()].sort()[0];
    if (!first) return null;

    const window = monthRange(start ?? first, end);
    // A year earlier with data and nothing since is still no data: a long gap in the surveys.
    if (!window.some((month) => cells.has(month))) return null;
    const previous = start ? monthRange(from!, monthKey(addMonths(monthDate(end), -12))) : null;

    return {
      window: { start: window[0], end },
      previous: previous && { start: previous[0], end: previous.at(-1)! },
      /** Mean share of the fleet tracked behind the window's estimates. */
      samplingRate: combine(
        window.flatMap((m) => [...(cells.get(m)?.values() ?? [])].map((c) => c.sampling_rate)),
        "mean",
      ),
      metrics: Object.fromEntries(
        METRIC_KEYS.map((metric) => {
          const now = overWindow(cells, window, metric);
          const before = previous && overWindow(cells, previous, metric);
          return [
            metric,
            {
              value: now.value,
              previous: before && sameBasis(before.value, now.shared, before.shared),
              series: now.perMonth.map(({ month, value }) => ({ month, value })),
            },
          ];
        }),
      ) as Record<
        MetricKey,
        {
          value: number | null;
          previous: number | null;
          series: { month: string; value: number | null }[];
        }
      >,
    };
  }),

  /**
   * One metric per month: a value per district, the district-months
   * (`YYYY-MM|district`) resting on fewer than FEW_LANDINGS landings, and the
   * districts combined (weighted by landings) with the same month a year
   * earlier. An estimate both methods make gets the same per method
   * (`methods`), both combining only the shared district-months, the counts of
   * district-months shared and left out, and no year earlier: it shows none.
   */
  monthly: publicProcedure.input(monthlyMetric).query(async ({ input }) => {
    const { districts, months, metric } = input;
    const keys = methodKeys(metric);
    const start = months ? windowStart(months) : null;
    // A year more than the window, for the comparison.
    const from = start && !keys ? addMonths(start, -12) : start;
    const filter = {
      ...match({ districts }),
      ...(from ? { date: { $gte: from, $lt: thisMonth() } } : {}),
    };
    const [docs, landingDocs] = await Promise.all([
      MonthlySummaryDistrictModel.find({ ...filter, metric: { $in: withTwin(metric) } }).lean(),
      DistrictSummaryModel.find({ ...filter, indicator: "n_submissions" }).lean(),
    ]);
    const cells = addCells(
      addCells(new Map(), docs, (d) => d.metric),
      landingDocs,
      (d) => d.indicator,
    );
    const inWindow = (month: string) => !start || month >= monthKey(start);
    // Every month with a summary, valued or not: a month without a value draws a gap, not a zero.
    const all = [...new Set(docs.map((d) => monthKey(d.date)))].sort();
    const window = all.filter(inWindow);
    // Both methods add up the same district-months, so each set is built once.
    const now = inTotals(cells, window, metric).keep;
    const earlier = inTotals(
      cells,
      all.filter((m) => !inWindow(m)),
      metric,
    ).keep;
    const at = (key: MetricKey, month: string) =>
      acrossDistricts(cells.get(month), key, inWindow(month) ? now : earlier).value;
    const series = (key: MetricKey) => ({
      rows: window.map(
        (month): MonthRow => ({
          month,
          ...Object.fromEntries(
            [...(cells.get(month) ?? [])].flatMap(([district, c]) =>
              c[key] == null ? [] : [[district, c[key]]],
            ),
          ),
        }),
      ),
      overall: window.map((month) => ({
        month,
        value: at(key, month),
        previous: keys ? null : at(key, monthKey(addMonths(monthDate(month), -12))),
      })),
    });
    const own = series(metric);
    return {
      ...own,
      thin: [...cells]
        .filter(([month]) => inWindow(month))
        .flatMap(([month, byDistrict]) =>
          [...byDistrict]
            .filter(([, c]) => c.n_submissions != null && c.n_submissions < FEW_LANDINGS)
            .map(([district]) => `${month}|${district}`),
        ),
      methods:
        keys &&
        (Object.fromEntries(
          METHODS.map((m) => [m, keys[m] === metric ? own : series(keys[m])]),
        ) as Record<Method, typeof own>),
      ...methodCoverage(cellsOf(cells, window), metric),
    };
  }),

  /**
   * One metric per calendar month over every year of data, each district's
   * value for that month averaged across years, and how many months of data
   * that rests on, per method (`methods`) for an estimate both methods make.
   * Months without a measurement are skipped, not counted as zero: a zero
   * claims the month was surveyed.
   */
  seasonality: publicProcedure
    .input(monthlyMetric.omit({ months: true }))
    .query(async ({ input }) => {
      const keys = methodKeys(input.metric);
      const docs = await MonthlySummaryDistrictModel.find({
        ...match(input),
        metric: { $in: withTwin(input.metric) },
      }).lean();
      // One pass: metric, calendar month and district → values; metric → months measured.
      const values = new Map<string, number[]>();
      const measured = new Map<string, Set<string>>();
      for (const d of docs) {
        if (d.value == null) continue;
        const key = `${d.metric}|${d.date.getUTCMonth() + 1}|${d.gaul_2_name}`;
        entry(values, key, () => []).push(d.value);
        entry(measured, d.metric, () => new Set<string>()).add(monthKey(d.date));
      }
      const districts = scopeDistricts(input.districts);
      const season = (metric: MetricKey): { months: number; rows: SeasonRow[] } => ({
        months: measured.get(metric)?.size ?? 0,
        rows: Array.from({ length: 12 }, (_, i) => {
          const row: SeasonRow = { month: i + 1 };
          for (const district of districts) {
            const vals = values.get(`${metric}|${i + 1}|${district}`);
            if (vals) row[district] = combine(vals, "mean");
          }
          return row;
        }),
      });
      const own = season(input.metric);
      return {
        ...own,
        methods:
          keys &&
          (Object.fromEntries(
            METHODS.map((m) => [m, keys[m] === input.metric ? own : season(keys[m])]),
          ) as Record<Method, typeof own>),
      };
    }),

  /** Landings, CPUE and RPUE per gear over the scope, most-used gear first. */
  byGear: publicProcedure.input(scope).query(async ({ input }) => {
    const docs = await GearSummaryDistrictModel.find({
      ...match(input),
      indicator: { $in: ["n_submissions", "cpue", "rpue"] },
      value: { $ne: null },
    }).lean();
    const gears = groupCells(
      docs,
      (d) => d.gear ?? null,
      (d) => d.indicator,
    );
    return [...gears]
      .map(([gear, byCell]) => {
        const cells = [...byCell.values()];
        const landings = cells.map((c) => c.n_submissions);
        return {
          gear,
          landings: sum(landings),
          cpue: combine(
            cells.map((c) => c.cpue),
            "mean",
            landings,
          ),
          rpue: combine(
            cells.map((c) => c.rpue),
            "mean",
            landings,
          ),
        };
      })
      .filter((g) => g.landings > 0)
      .sort((a, b) => b.landings - a.landings);
  }),

  /**
   * Landings per district and month in scope, the latest month with any, when
   * coasts last pushed the summaries (the push's metadata document), and the
   * districts with landings that the country registry doesn't list, whose
   * figures no page shows until they are added to it.
   */
  coverage: publicProcedure.input(scope).query(async ({ input }) => {
    const filter = match(input);
    const [byMonth, meta, surveyed] = await Promise.all([
      // One value per district and month, as every other procedure reads them: coasts can write a
      // district twice when two GAUL units share its name.
      districtCells(filter, ["n_submissions"]),
      DistrictSummaryModel.collection.findOne<{ timestamp?: Date | Date[] }>({ type: "metadata" }),
      DistrictSummaryModel.distinct("gaul_2_name", {
        date: filter.date,
        indicator: "n_submissions",
        value: { $gt: 0 },
      }),
    ]);
    const known = activeCountry().districts;
    const unlisted = surveyed.filter((d): d is string => !!d && !known.includes(d)).sort();
    warnUnlisted(unlisted);
    const cells = [...byMonth]
      .flatMap(([month, districts]) =>
        [...districts].map(([district, c]) => ({ district, month, landings: c.n_submissions })),
      )
      .filter((c) => c.landings > 0);
    const months = cells.map((c) => c.month).sort();
    return {
      landings: sum(cells.map((c) => c.landings)),
      districts: new Set(cells.map((c) => c.district)).size,
      through: months.at(-1) ?? null,
      // mongolite writes R's length-1 vectors as one-element arrays.
      updatedAt: [meta?.timestamp].flat()[0] ?? null,
      cells,
      unlisted,
    };
  }),

  /** Taxa metrics per district and taxon, each combined across the window's months. */
  taxa: publicProcedure
    .input(scope.extend({ metrics: z.array(z.enum(TAXA_METRIC_KEYS)).nonempty() }))
    .query(async ({ input }): Promise<TaxonRow[]> => {
      const groups = await TaxaSummaryDistrictModel.aggregate<{
        _id: { district: string; taxon: string | null; metric: TaxaMetricKey };
        sum: number;
        avg: number;
      }>([
        { $match: { ...match(input), metric: { $in: input.metrics }, value: { $ne: null } } },
        {
          $group: {
            _id: { district: "$gaul_2_name", taxon: "$catch_taxon", metric: "$metric" },
            sum: { $sum: "$value" },
            avg: { $avg: "$value" },
          },
        },
      ]).exec();

      const rows = new Map<string, TaxonRow>();
      for (const { _id, sum, avg } of groups) {
        const { district, taxon, metric } = _id;
        const row = entry(rows, `${district}|${taxon}`, (): TaxonRow => ({ district, taxon }));
        row[metric] = TAXA_METRICS[metric].overMonths === "sum" ? sum : avg;
      }
      return [...rows.values()];
    }),

  /** One taxa metric per taxon, largest first: each district's months combined, then the districts. */
  composition: publicProcedure
    .input(scope.extend({ metric: z.enum(TAXA_METRIC_KEYS) }))
    .query(({ input }) => {
      const { overMonths, overDistricts } = TAXA_METRICS[input.metric];
      return TaxaSummaryDistrictModel.aggregate<CompositionRow>([
        { $match: { ...match(input), metric: input.metric, value: { $gt: 0 } } },
        {
          $group: {
            _id: { taxon: "$catch_taxon", district: "$gaul_2_name" },
            value: accumulate(overMonths),
          },
        },
        {
          $group: {
            _id: "$_id.taxon",
            total: accumulate(overDistricts),
            groups: { $push: { group: "$_id.district", value: "$value" } },
          },
        },
        { $match: { total: { $gt: 0 } } },
        { $project: { _id: 0, taxon: "$_id", total: 1, groups: 1 } },
        { $sort: { total: -1 } },
      ]).exec();
    }),

  /** Recorded catch per taxon and gear over the scope; unavailable before coasts 4.15.0 wrote the table. */
  gearComposition: publicProcedure.input(scope).query(async ({ input }) => {
    const [available, rows] = await Promise.all([
      GearTaxaSummaryModel.exists({ catch_taxon: { $exists: true } }).then(Boolean),
      GearTaxaSummaryModel.aggregate<CompositionRow>([
        { $match: { ...match(input), catch_kg: { $gt: 0 } } },
        { $group: { _id: { taxon: "$catch_taxon", gear: "$gear" }, value: { $sum: "$catch_kg" } } },
        {
          $group: {
            _id: "$_id.taxon",
            total: { $sum: "$value" },
            groups: { $push: { group: "$_id.gear", value: "$value" } },
          },
        },
        { $project: { _id: 0, taxon: "$_id", total: 1, groups: 1 } },
        { $sort: { total: -1 } },
      ]).exec(),
    ]);
    return { available, rows };
  }),

  /**
   * Price per kg of each taxon, weighted by its catch in each district and
   * month; most-landed first. Unavailable before coasts 4.15.0, whose taxa
   * traits mark the corrected prices (older ones divided a trip's value by one taxon's weight).
   * ponytail: drop the gate once every country's portal has taxa traits.
   */
  speciesPrice: publicProcedure.input(scope).query(async ({ input }) => {
    const [available, docs] = await Promise.all([
      TaxaTraitsModel.exists({ catch_taxon: { $exists: true } }).then(Boolean),
      TaxaSummaryDistrictModel.find({
        ...match(input),
        metric: { $in: ["catch_kg", "price_kg"] },
        value: { $ne: null },
      }).lean(),
    ]);
    if (!available) return { available, rows: [] };
    const taxa = groupCells(
      docs.filter((d) => d.catch_taxon),
      (d) => d.catch_taxon,
      (d) => d.metric,
    );
    const rows = [...taxa]
      .map(([taxon, byCell]) => {
        const cells = [...byCell.values()];
        return {
          taxon: taxon!,
          catch_kg: sum(cells.map((c) => c.catch_kg)),
          price_kg: combine(
            cells.map((c) => c.price_kg),
            "mean",
            cells.map((c) => c.catch_kg),
          ),
        };
      })
      .filter((t): t is typeof t & { price_kg: number } => t.price_kg != null && t.catch_kg > 0)
      .sort((a, b) => b.catch_kg - a.catch_kg);
    return { available: true, rows };
  }),

  /** Each taxon's common name from FishBase, for the taxa that have one. */
  speciesNames: publicProcedure.query(async () => {
    const traits = await TaxaTraitsModel.find(
      { english_name: { $nin: [null, ""] } },
      { catch_taxon: 1, english_name: 1 },
    ).lean();
    return Object.fromEntries(traits.map((t) => [t.catch_taxon, t.english_name as string]));
  }),

  /**
   * Recorded catch by the FishBase traits of each taxon: per month, the share
   * in each vulnerability band, the share of sharks and rays and the mean
   * trophic level; and per taxon, its catch and traits. Taxa with no traits
   * count as unknown.
   */
  speciesTraits: publicProcedure.input(scope).query(async ({ input }) => {
    const [catches, traits] = await Promise.all([
      TaxaSummaryDistrictModel.aggregate<{
        _id: { month: string; taxon: string | null };
        kg: number;
      }>([
        { $match: { ...match(input), metric: "catch_kg", value: { $gt: 0 } } },
        {
          $group: {
            _id: {
              month: { $dateToString: { format: "%Y-%m", date: "$date" } },
              taxon: "$catch_taxon",
            },
            kg: { $sum: "$value" },
          },
        },
      ]).exec(),
      TaxaTraitsModel.find({ catch_taxon: { $exists: true } }).lean(),
    ]);
    const traitsOf = new Map(traits.map((t) => [t.catch_taxon, t]));

    type Month = {
      total: number;
      bands: Record<VulnerabilityBand | "unknown", number>;
      sharks: number;
      tl: number;
      tlKg: number;
    };
    let scored = 0;
    const months = new Map<string, Month>();
    const species = new Map<string | null, number>();
    for (const { _id, kg } of catches) {
      const taxon = _id.taxon ?? null;
      const t = taxon ? traitsOf.get(taxon) : undefined;
      const m = entry(
        months,
        _id.month,
        (): Month => ({
          total: 0,
          bands: { low: 0, moderate: 0, high: 0, very_high: 0, unknown: 0 },
          sharks: 0,
          tl: 0,
          tlKg: 0,
        }),
      );
      m.total += kg;
      const band = vulnerabilityBand(t?.vulnerability);
      m.bands[band ?? "unknown"] += kg;
      if (band) scored += kg;
      if (t?.class === "Elasmobranchii") m.sharks += kg;
      if (t?.trophic_level != null) {
        m.tl += t.trophic_level * kg;
        m.tlKg += kg;
      }
      species.set(taxon, (species.get(taxon) ?? 0) + kg);
    }

    const total = sum([...species.values()]);
    const share = (kg: number, of: number) => (of > 0 ? (100 * kg) / of : null);
    const bands = [...VULNERABILITY_BANDS, "unknown"] as const;
    const all = [...months.values()];
    return {
      traitsAvailable: traits.some((t) => t.vulnerability != null),
      /** Share (%) of the recorded catch whose taxon has a vulnerability score. */
      coverage: share(scored, total),
      /** Shares (%) of the whole window's recorded catch: highly or very highly vulnerable, sharks and rays. */
      window: {
        high: share(sum(all.map((m) => m.bands.high + m.bands.very_high)), total),
        sharks_rays: share(sum(all.map((m) => m.sharks)), total),
      },
      months: [...months]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, m]) => ({
          month,
          catch_kg: m.total,
          ...(Object.fromEntries(bands.map((b) => [b, share(m.bands[b], m.total)])) as Record<
            (typeof bands)[number],
            number | null
          >),
          sharks_rays: share(m.sharks, m.total),
          trophic_level: m.tlKg > 0 ? m.tl / m.tlKg : null,
        })),
      species: [...species]
        .map(([taxon, kg]) => {
          const t = taxon ? traitsOf.get(taxon) : undefined;
          return {
            taxon,
            english_name: t?.english_name ?? null,
            catch_kg: kg,
            share: share(kg, total),
            vulnerability: t?.vulnerability ?? null,
            vulnerability_min: t?.vulnerability_min ?? null,
            vulnerability_max: t?.vulnerability_max ?? null,
            n_species: t?.n_species ?? null,
            n_threatened: t?.n_threatened ?? null,
            n_cites: t?.n_cites ?? null,
            iucn_code: t?.iucn_code ?? null,
            trophic_level: t?.trophic_level ?? null,
            sharks_rays: t?.class === "Elasmobranchii",
          };
        })
        .sort((a, b) => b.catch_kg - a.catch_kg),
    };
  }),

  /**
   * Recorded catch per length class of each taxon and gear over the scope, with
   * the trips measured behind it, and each taxon's lengths at maturity and optimum.
   */
  lengths: publicProcedure.input(scope).query(async ({ input }) => {
    type Id = { taxon: string; gear: string | null };
    const [available, [facets], maturity] = await Promise.all([
      LengthSummaryModel.exists({ catch_taxon: { $exists: true } }).then(Boolean),
      LengthSummaryModel.aggregate<{
        classes: { _id: Id & { min: number; max: number | null }; catch_kg: number }[];
        trips: { _id: Id; trips: number }[];
      }>([
        { $match: match(input) },
        {
          $facet: {
            classes: [
              {
                $group: {
                  _id: {
                    taxon: "$catch_taxon",
                    gear: "$gear",
                    min: "$length_min",
                    max: "$length_max",
                  },
                  catch_kg: { $sum: "$catch_kg" },
                },
              },
            ],
            // n_trips repeats on every length class of a taxon, gear, district and month: count it once each.
            trips: [
              {
                $group: {
                  _id: {
                    taxon: "$catch_taxon",
                    gear: "$gear",
                    district: "$gaul_2_name",
                    date: "$date",
                  },
                  n: { $first: "$n_trips" },
                },
              },
              {
                $group: { _id: { taxon: "$_id.taxon", gear: "$_id.gear" }, trips: { $sum: "$n" } },
              },
            ],
          },
        },
      ]).exec(),
      TaxaTraitsModel.find(
        { $or: [{ length_maturity_cm: { $gt: 0 } }, { length_optimum_cm: { $gt: 0 } }] },
        { catch_taxon: 1, length_maturity_cm: 1, length_optimum_cm: 1 },
      ).lean(),
    ]);
    const measured = new Map<string, MeasuredCatch>();
    const of = ({ taxon, gear }: Id) =>
      entry(
        measured,
        `${taxon}|${gear}`,
        (): MeasuredCatch => ({ taxon, gear: gear ?? null, classes: [], trips: 0 }),
      );
    for (const { _id, catch_kg } of facets?.classes ?? []) {
      of(_id).classes.push({ length_min: _id.min, length_max: _id.max ?? null, catch_kg });
    }
    for (const { _id, trips } of facets?.trips ?? []) of(_id).trips = trips;
    return {
      /** Whether this database has length summaries at all (coasts 4.15.0 onwards). */
      available,
      measured: [...measured.values()],
      maturity: lengthsOf(maturity, "length_maturity_cm"),
      optimum: lengthsOf(maturity, "length_optimum_cm"),
    };
  }),
});
