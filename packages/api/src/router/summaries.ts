import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  combine,
  GEAR_METRIC_KEYS,
  METRIC_KEYS,
  METRICS,
  TAXA_METRIC_KEYS,
  TAXA_METRICS,
  type Combine,
  type MetricKey,
  type TaxaMetricKey,
} from "@repo/domain/metrics";
import { DistrictSummaryModel } from "@repo/nosql/schema/district-summary";
import { GearSummaryDistrictModel } from "@repo/nosql/schema/gear-summary-district";
import { MonthlySummaryDistrictModel } from "@repo/nosql/schema/monthly-summary-district";
import { TaxaSummaryDistrictModel } from "@repo/nosql/schema/taxa-summary-district";
import { activeCountry } from "../lib/country";
import { createTRPCRouter, publicProcedure } from "../trpc";

/*
 * Portal summary queries. Every procedure takes the same scope (which
 * districts, which month window), combines values by the metric catalogue's
 * rules and returns typed rows in the dashboard's terms (`district`, `month`,
 * `taxon`). Coasts' column names stay in this file, so renaming one in
 * `export_portal` is fixed here and nowhere else.
 */

/** One month (`YYYY-MM`) with a value per district or region. */
export type MonthRow = { month: string; [series: string]: number | string | null };
/** One calendar month (1–12) with each district's mean across years. */
export type SeasonRow = { month: number; [district: string]: number | null };
export type DistrictRow = { district: string } & Record<MetricKey, number | null>;
// Coasts leaves some catches without a taxon and some trips without a gear: those come back as null.
export type TaxonRow = { district: string; taxon: string | null; scientificName: string | null } & Partial<
  Record<TaxaMetricKey, number>
>;

const scope = z.object({
  /** Districts of the active country; all of them when left out, none when empty. */
  districts: z.array(z.string()).optional(),
  /** The current month plus the `months - 1` before it; all time when left out. */
  months: z.number().int().positive().optional(),
});
type Scope = z.infer<typeof scope>;

/** First day (UTC) of the window's earliest month. Summaries are dated on the 1st, in UTC. */
function windowStart(months: number, now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
}

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/** The Mongo filter for a scope. Districts are checked against the active country. */
function match({ districts, months }: Scope) {
  const known = activeCountry().districts;
  const unknown = districts?.filter((d) => !known.includes(d)) ?? [];
  if (unknown.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown districts: ${unknown.join(", ")}` });
  }
  return {
    gaul_2_name: { $in: districts ?? known },
    ...(months ? { date: { $gte: windowStart(months) } } : {}),
  };
}

/** `map.get(key)`, creating the entry with `make()` first when it is missing. */
const entry = <K, V>(map: Map<K, V>, key: K, make: () => V) => map.get(key) ?? map.set(key, make()).get(key)!;

/** The Mongo accumulator for a combine rule. */
const accumulate = (how: Combine) => (how === "sum" ? { $sum: "$value" } : { $avg: "$value" });

const metricOf = scope.extend({ metric: z.enum(METRIC_KEYS) });

export const summariesRouter = createTRPCRouter({
  /** Every metric per district over the window: each combined across months by its rule. */
  byDistrict: publicProcedure.input(scope).query(async ({ input }): Promise<DistrictRow[]> => {
    const docs = await DistrictSummaryModel.find({ ...match(input), indicator: { $in: METRIC_KEYS } }).lean();
    const values = new Map<string, number[]>();
    for (const d of docs) if (d.value != null) entry(values, `${d.gaul_2_name}|${d.indicator}`, () => []).push(d.value);

    return (input.districts ?? activeCountry().districts).map((district) => ({
      district,
      ...(Object.fromEntries(
        METRIC_KEYS.map((m) => [m, combine(values.get(`${district}|${m}`) ?? [], METRICS[m].overMonths)])
      ) as Record<MetricKey, number | null>),
    }));
  }),

  /** Every metric per month and region: each region's districts combined by the metric's rule. */
  regionTrend: publicProcedure
    .input(z.object({ months: z.number().int().positive() }))
    .query(async ({ input }): Promise<Record<MetricKey, MonthRow[]>> => {
      const { districtToRegion } = activeCountry();
      const docs = await DistrictSummaryModel.find({ ...match(input), indicator: { $in: METRIC_KEYS } })
        .sort({ date: 1 })
        .lean();
      // metric → month → region → district values
      const trend = new Map<string, Map<string, Map<string, number[]>>>();
      for (const d of docs) {
        if (d.value == null) continue;
        const byMonth = entry(trend, d.indicator, () => new Map<string, Map<string, number[]>>());
        const byRegion = entry(byMonth, monthKey(d.date), () => new Map<string, number[]>());
        entry(byRegion, districtToRegion[d.gaul_2_name], () => []).push(d.value);
      }

      return Object.fromEntries(
        METRIC_KEYS.map((m) => [
          m,
          [...(trend.get(m) ?? [])].map(([month, regions]) => ({
            month,
            ...Object.fromEntries([...regions].map(([region, vals]) => [region, combine(vals, METRICS[m].overDistricts)])),
          })),
        ])
      ) as Record<MetricKey, MonthRow[]>;
    }),

  /** One metric per month, a value per district. */
  monthly: publicProcedure.input(metricOf).query(async ({ input }): Promise<MonthRow[]> => {
    const docs = await MonthlySummaryDistrictModel.find({ ...match(input), metric: input.metric })
      .sort({ date: 1 })
      .lean();
    const rows = new Map<string, MonthRow>();
    for (const d of docs) {
      const row = entry(rows, monthKey(d.date), (): MonthRow => ({ month: monthKey(d.date) }));
      if (d.value != null) row[d.gaul_2_name] = d.value; // a month without a value draws a gap, not a zero
    }
    return [...rows.values()];
  }),

  /**
   * One metric per calendar month, each district's value for that month
   * averaged across the window's years. Months without a measurement are
   * skipped, not counted as zero: a zero claims the month was surveyed.
   */
  seasonality: publicProcedure.input(metricOf).query(async ({ input }): Promise<SeasonRow[]> => {
    const docs = await MonthlySummaryDistrictModel.find({ ...match(input), metric: input.metric }).lean();
    const values = new Map<string, number[]>();
    for (const d of docs) {
      if (d.value != null) entry(values, `${d.date.getUTCMonth() + 1}|${d.gaul_2_name}`, () => []).push(d.value);
    }

    // Every calendar month the window touches, so the radar keeps its spokes where a month has no data.
    const thisMonth = new Date().getUTCMonth();
    const spokes = Array.from({ length: Math.min(input.months ?? 12, 12) }, (_, i) => ((thisMonth - i + 12) % 12) + 1);
    const districts = input.districts ?? activeCountry().districts;
    return spokes
      .sort((a, b) => a - b)
      .map((month) => {
        const row: SeasonRow = { month };
        for (const district of districts) {
          const vals = values.get(`${month}|${district}`);
          if (vals) row[district] = combine(vals, "mean");
        }
        return row;
      });
  }),

  /** CPUE or RPUE per gear type, averaged over the scope's rows. */
  byGear: publicProcedure
    .input(scope.extend({ metric: z.enum(GEAR_METRIC_KEYS) }))
    .query(({ input }) =>
      GearSummaryDistrictModel.aggregate<{ gear: string | null; value: number; records: number; districts: number }>([
        // The gear summaries name the same measure differently (mean_cpue → cpue).
        { $match: { ...match(input), indicator: METRICS[input.metric].gearIndicator, value: { $ne: null } } },
        {
          $group: {
            _id: "$gear",
            value: { $avg: "$value" },
            records: { $sum: 1 },
            districts: { $addToSet: "$gaul_2_name" },
          },
        },
        { $project: { _id: 0, gear: "$_id", value: 1, records: 1, districts: { $size: "$districts" } } },
        { $sort: { value: -1 } },
      ]).exec()
    ),

  /** Taxa metrics per district and taxon, each combined across the window's months. */
  taxa: publicProcedure
    .input(scope.extend({ metrics: z.array(z.enum(TAXA_METRIC_KEYS)).nonempty() }))
    .query(async ({ input }): Promise<TaxonRow[]> => {
      const groups = await TaxaSummaryDistrictModel.aggregate<{
        _id: { district: string; taxon: string | null; metric: TaxaMetricKey };
        scientificName: string | null;
        sum: number;
        avg: number;
      }>([
        { $match: { ...match(input), metric: { $in: input.metrics }, value: { $ne: null } } },
        {
          $group: {
            _id: { district: "$gaul_2_name", taxon: "$catch_taxon", metric: "$metric" },
            scientificName: { $first: "$scientific_name" },
            sum: { $sum: "$value" },
            avg: { $avg: "$value" },
          },
        },
      ]).exec();

      const rows = new Map<string, TaxonRow>();
      for (const { _id, scientificName, sum, avg } of groups) {
        const { district, taxon, metric } = _id;
        const row = entry(rows, `${district}|${taxon}`, (): TaxonRow => ({ district, taxon, scientificName }));
        row[metric] = TAXA_METRICS[metric].overMonths === "sum" ? sum : avg;
      }
      return [...rows.values()];
    }),

  /** One taxa metric per taxon, largest first: each district's months combined, then the districts. */
  composition: publicProcedure
    .input(scope.extend({ metric: z.enum(TAXA_METRIC_KEYS) }))
    .query(({ input }) => {
      const { overMonths, overDistricts } = TAXA_METRICS[input.metric];
      return TaxaSummaryDistrictModel.aggregate<{
        taxon: string | null;
        scientificName: string | null;
        total: number;
        districts: { district: string; value: number }[];
      }>([
        { $match: { ...match(input), metric: input.metric, value: { $gt: 0 } } },
        {
          $group: {
            _id: { taxon: "$catch_taxon", district: "$gaul_2_name" },
            scientificName: { $first: "$scientific_name" },
            value: accumulate(overMonths),
          },
        },
        {
          $group: {
            _id: "$_id.taxon",
            scientificName: { $first: "$scientificName" },
            total: accumulate(overDistricts),
            districts: { $push: { district: "$_id.district", value: "$value" } },
          },
        },
        { $match: { total: { $gt: 0 } } },
        { $project: { _id: 0, taxon: "$_id", scientificName: 1, total: 1, districts: 1 } },
        { $sort: { total: -1 } },
      ]).exec();
    }),
});
