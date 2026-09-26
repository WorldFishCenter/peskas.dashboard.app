import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  combine,
  FEW_LANDINGS,
  METRIC_KEYS,
  METRICS,
  MONTHLY_METRIC_KEYS,
  TAXA_METRIC_KEYS,
  TAXA_METRICS,
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
export type CompositionRow = { taxon: string | null; total: number; groups: { group: string | null; value: number }[] };

/** One month (`YYYY-MM`) with a value per district. */
export type MonthRow = { month: string; [series: string]: number | string | null };
/** One calendar month (1–12) with each district's mean across years. */
export type SeasonRow = { month: number; [district: string]: number | null };
export type DistrictRow = { district: string; sampling_rate: number | null } & Record<MetricKey, number | null>;
// Coasts leaves some catches without a taxon and some trips without a gear: those come back as null.
// Coasts writes the scientific name as the taxon.
export type TaxonRow = { district: string; taxon: string | null } & Partial<Record<TaxaMetricKey, number>>;

const scope = z.object({
  /** Districts of the active country; all of them when left out, none when empty. */
  districts: z.array(z.string()).optional(),
  /** The current month plus the `months - 1` before it; all time when left out. */
  months: z.number().int().positive().optional(),
});
type Scope = z.infer<typeof scope>;

/** First day (UTC) of the month `by` months from `date`'s. Summaries are dated on the 1st, in UTC. */
const addMonths = (date: Date, by: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + by, 1));

/** First day (UTC) of the window's earliest month. */
const windowStart = (months: number, now = new Date()) => addMonths(now, -(months - 1));

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
    throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown districts: ${unknown.join(", ")}` });
  }
  return districts ?? known;
}

/** The Mongo filter for a scope. */
function match({ districts, months }: Scope) {
  return {
    gaul_2_name: { $in: scopeDistricts(districts) },
    ...(months ? { date: { $gte: windowStart(months) } } : {}),
  };
}

/** `map.get(key)`, creating the entry with `make()` first when it is missing. */
const entry = <K, V>(map: Map<K, V>, key: K, make: () => V) => map.get(key) ?? map.set(key, make()).get(key)!;

/** The Mongo accumulator for a combine rule. */
const accumulate = (how: Combine) => (how === "sum" ? { $sum: "$value" } : { $avg: "$value" });

const sum = (values: readonly (number | null | undefined)[]) => combine(values, "sum") ?? 0;

/** Indicator values of one district in one month. */
type Cell = Record<string, number>;
/** month → district → indicator values. */
type Cells = Map<string, Map<string, Cell>>;

/** Read district summaries into month → district → indicator values. */
async function districtCells(filter: object, indicators: string[]): Promise<Cells> {
  const docs = await DistrictSummaryModel.find({ ...filter, indicator: { $in: indicators } }).lean();
  const cells: Cells = new Map();
  for (const d of docs) {
    if (d.value == null) continue;
    entry(entry(cells, monthKey(d.date), () => new Map()), d.gaul_2_name, (): Cell => ({}))[d.indicator] = d.value;
  }
  return cells;
}

/** Summary docs' values gathered per group and per district-month: group → "district|month" → field → value. */
function groupCells<D extends { gaul_2_name: string; date?: Date; value?: number | null }>(
  docs: D[],
  group: (d: D) => string | null,
  field: (d: D) => string
) {
  const groups = new Map<string | null, Map<string, Cell>>();
  for (const d of docs) {
    if (d.value == null) continue;
    const cell = entry(entry(groups, group(d), () => new Map()), `${d.gaul_2_name}|${d.date?.toISOString()}`, (): Cell => ({}));
    cell[field(d)] = d.value;
  }
  return groups;
}

/** Taxon → a length trait, for the taxa that have it. */
const lengthsOf = <T extends { catch_taxon: string }>(traits: T[], key: keyof T) =>
  Object.fromEntries(traits.filter((t) => Number(t[key]) > 0).map((t) => [t.catch_taxon, Number(t[key])])) as Record<string, number>;

/** One metric over some districts in one month, and the landings behind it. */
function acrossDistricts(byDistrict: Map<string, Cell> | undefined, metric: MetricKey, keep: (district: string) => boolean) {
  const rows = [...(byDistrict ?? [])].filter(([district]) => keep(district)).map(([, cell]) => cell);
  const landings = rows.map((r) => r.n_submissions);
  return { value: combine(rows.map((r) => r[metric]), METRICS[metric].overDistricts, landings), landings: sum(landings) };
}

/** One metric over some districts and months: districts combined per month, then the months. */
function overWindow(cells: Cells, months: string[], metric: MetricKey, keep: (district: string) => boolean = () => true) {
  const perMonth = months.map((m) => acrossDistricts(cells.get(m), metric, keep));
  return combine(
    perMonth.map((p) => p.value),
    METRICS[metric].overMonths,
    perMonth.map((p) => p.landings)
  );
}

const monthlyMetric = scope.extend({ metric: z.enum(MONTHLY_METRIC_KEYS) });

export const summariesRouter = createTRPCRouter({
  /**
   * Every metric per district over the window, each combined across months by
   * its rule, plus the mean share of the fleet tracked behind the estimates.
   */
  byDistrict: publicProcedure.input(scope).query(async ({ input }): Promise<DistrictRow[]> => {
    const cells = await districtCells(match(input), [...METRIC_KEYS, "sampling_rate"]);
    return scopeDistricts(input.districts).map((district) => {
      const months = [...cells.values()].map((byDistrict) => byDistrict.get(district)).filter((c): c is Cell => !!c);
      const landings = months.map((m) => m.n_submissions);
      return {
        district,
        ...(Object.fromEntries(
          METRIC_KEYS.map((m) => [m, combine(months.map((c) => c[m]), METRICS[m].overMonths, landings)])
        ) as Record<MetricKey, number | null>),
        sampling_rate: combine(months.map((c) => c.sampling_rate), "mean"),
      };
    });
  }),

  /**
   * The country's headline figures over the last `months` complete months (all
   * of them when left out) against the same months a year earlier, per region
   * and per month. The current month would read as a drop while its landings come in.
   */
  headline: publicProcedure
    .input(z.object({ months: z.number().int().positive().optional() }))
    .query(async ({ input }) => {
      const { districtToRegion } = activeCountry();
      const end = monthKey(addMonths(new Date(), -1));
      const start = input.months ? monthKey(addMonths(monthDate(end), -(input.months - 1))) : undefined;
      const from = start ? monthKey(addMonths(monthDate(start), -12)) : undefined;

      const cells = await districtCells(
        { ...match({}), date: { ...(from ? { $gte: monthDate(from) } : {}), $lte: monthDate(end) } },
        [...METRIC_KEYS, "sampling_rate"]
      );
      const first = [...cells.keys()].sort()[0];
      if (!first) return null;

      const window = monthRange(start ?? first, end);
      const previous = start ? monthRange(from!, monthKey(addMonths(monthDate(end), -12))) : null;
      const regions = [...new Set(Object.values(districtToRegion))];

      return {
        window: { start: window[0], end },
        previous: previous && { start: previous[0], end: previous.at(-1)! },
        /** Mean share of the fleet tracked behind the window's estimates. */
        samplingRate: combine(
          window.flatMap((m) => [...(cells.get(m)?.values() ?? [])].map((c) => c.sampling_rate)),
          "mean"
        ),
        metrics: Object.fromEntries(
          METRIC_KEYS.map((metric) => [
            metric,
            {
              value: overWindow(cells, window, metric),
              previous: previous && overWindow(cells, previous, metric),
              series: window.map((month) => ({ month, value: acrossDistricts(cells.get(month), metric, () => true).value })),
              regions: Object.fromEntries(
                regions.map((region) => [region, overWindow(cells, window, metric, (d) => districtToRegion[d] === region)])
              ),
            },
          ])
        ) as Record<
          MetricKey,
          {
            value: number | null;
            previous: number | null;
            series: { month: string; value: number | null }[];
            regions: Record<string, number | null>;
          }
        >,
      };
    }),

  /**
   * One metric per month, a value per district, and the district-months
   * (`YYYY-MM|district`) resting on fewer than FEW_LANDINGS landings.
   */
  monthly: publicProcedure.input(monthlyMetric).query(async ({ input }): Promise<{ rows: MonthRow[]; thin: string[] }> => {
    const [docs, landings] = await Promise.all([
      MonthlySummaryDistrictModel.find({ ...match(input), metric: input.metric }).sort({ date: 1 }).lean(),
      DistrictSummaryModel.find({ ...match(input), indicator: "n_submissions", value: { $lt: FEW_LANDINGS } }).lean(),
    ]);
    const rows = new Map<string, MonthRow>();
    for (const d of docs) {
      const row = entry(rows, monthKey(d.date), (): MonthRow => ({ month: monthKey(d.date) }));
      if (d.value != null) row[d.gaul_2_name] = d.value; // a month without a value draws a gap, not a zero
    }
    return { rows: [...rows.values()], thin: landings.map((d) => `${monthKey(d.date)}|${d.gaul_2_name}`) };
  }),

  /**
   * One metric per calendar month over every year of data, each district's
   * value for that month averaged across years, and how many months of data
   * that rests on. Months without a measurement are skipped, not counted as
   * zero: a zero claims the month was surveyed.
   */
  seasonality: publicProcedure
    .input(monthlyMetric.omit({ months: true }))
    .query(async ({ input }): Promise<{ months: number; rows: SeasonRow[] }> => {
      const docs = await MonthlySummaryDistrictModel.find({ ...match(input), metric: input.metric }).lean();
      const values = new Map<string, number[]>();
      const measured = new Set<string>();
      for (const d of docs) {
        if (d.value == null) continue;
        entry(values, `${d.date.getUTCMonth() + 1}|${d.gaul_2_name}`, () => []).push(d.value);
        measured.add(monthKey(d.date));
      }

      const districts = scopeDistricts(input.districts);
      const rows = Array.from({ length: 12 }, (_, i) => {
        const row: SeasonRow = { month: i + 1 };
        for (const district of districts) {
          const vals = values.get(`${i + 1}|${district}`);
          if (vals) row[district] = combine(vals, "mean");
        }
        return row;
      });
      return { months: measured.size, rows };
    }),

  /** Landings, CPUE and RPUE per gear over the scope, most-used gear first. */
  byGear: publicProcedure.input(scope).query(async ({ input }) => {
    const docs = await GearSummaryDistrictModel.find({
      ...match(input),
      indicator: { $in: ["n_submissions", "cpue", "rpue"] },
      value: { $ne: null },
    }).lean();
    const gears = groupCells(docs, (d) => d.gear ?? null, (d) => d.indicator);
    return [...gears]
      .map(([gear, byCell]) => {
        const cells = [...byCell.values()];
        const landings = cells.map((c) => c.n_submissions);
        return {
          gear,
          landings: sum(landings),
          cpue: combine(cells.map((c) => c.cpue), "mean", landings),
          rpue: combine(cells.map((c) => c.rpue), "mean", landings),
        };
      })
      .filter((g) => g.landings > 0)
      .sort((a, b) => b.landings - a.landings);
  }),

  /**
   * Landings per district and month in scope, the latest month with any, and
   * when coasts last pushed the summaries (the push's metadata document).
   */
  coverage: publicProcedure.input(scope).query(async ({ input }) => {
    const [docs, meta] = await Promise.all([
      DistrictSummaryModel.find({ ...match(input), indicator: "n_submissions", value: { $gt: 0 } }).lean(),
      DistrictSummaryModel.collection.findOne<{ timestamp?: Date | Date[] }>({ type: "metadata" }),
    ]);
    const cells = docs.map((d) => ({ district: d.gaul_2_name, month: monthKey(d.date), landings: d.value }));
    const months = cells.map((c) => c.month).sort();
    return {
      landings: sum(cells.map((c) => c.landings)),
      districts: new Set(cells.map((c) => c.district)).size,
      through: months.at(-1) ?? null,
      // mongolite writes R's length-1 vectors as one-element arrays.
      updatedAt: [meta?.timestamp].flat()[0] ?? null,
      cells,
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
      (d) => d.metric
    );
    const rows = [...taxa]
      .map(([taxon, byCell]) => {
        const cells = [...byCell.values()];
        return {
          taxon: taxon!,
          catch_kg: sum(cells.map((c) => c.catch_kg)),
          price_kg: combine(cells.map((c) => c.price_kg), "mean", cells.map((c) => c.catch_kg)),
        };
      })
      .filter((t): t is typeof t & { price_kg: number } => t.price_kg != null && t.catch_kg > 0)
      .sort((a, b) => b.catch_kg - a.catch_kg);
    return { available: true, rows };
  }),

  /**
   * Recorded catch by the FishBase traits of each taxon: per month, the share
   * in each vulnerability band, the share of sharks and rays and the mean
   * trophic level; and per taxon, its catch and traits. Taxa with no traits
   * count as unknown.
   */
  speciesTraits: publicProcedure.input(scope).query(async ({ input }) => {
    const [catches, traits] = await Promise.all([
      TaxaSummaryDistrictModel.aggregate<{ _id: { month: string; taxon: string | null }; kg: number }>([
        { $match: { ...match(input), metric: "catch_kg", value: { $gt: 0 } } },
        {
          $group: {
            _id: { month: { $dateToString: { format: "%Y-%m", date: "$date" } }, taxon: "$catch_taxon" },
            kg: { $sum: "$value" },
          },
        },
      ]).exec(),
      TaxaTraitsModel.find({ catch_taxon: { $exists: true } }).lean(),
    ]);
    const traitsOf = new Map(traits.map((t) => [t.catch_taxon, t]));

    type Month = { total: number; bands: Record<VulnerabilityBand | "unknown", number>; sharks: number; tl: number; tlKg: number };
    let scored = 0;
    const months = new Map<string, Month>();
    const species = new Map<string | null, number>();
    for (const { _id, kg } of catches) {
      const taxon = _id.taxon ?? null;
      const t = taxon ? traitsOf.get(taxon) : undefined;
      const m = entry(months, _id.month, (): Month => ({
        total: 0,
        bands: { low: 0, moderate: 0, high: 0, very_high: 0, unknown: 0 },
        sharks: 0,
        tl: 0,
        tlKg: 0,
      }));
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
    return {
      traitsAvailable: traits.some((t) => t.vulnerability != null),
      /** Share (%) of the recorded catch whose taxon has a vulnerability score. */
      coverage: share(scored, total),
      months: [...months]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, m]) => ({
          month,
          catch_kg: m.total,
          ...(Object.fromEntries(bands.map((b) => [b, share(m.bands[b], m.total)])) as Record<(typeof bands)[number], number | null>),
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
                  _id: { taxon: "$catch_taxon", gear: "$gear", min: "$length_min", max: "$length_max" },
                  catch_kg: { $sum: "$catch_kg" },
                },
              },
            ],
            // n_trips repeats on every length class of a taxon, gear, district and month: count it once each.
            trips: [
              {
                $group: {
                  _id: { taxon: "$catch_taxon", gear: "$gear", district: "$gaul_2_name", date: "$date" },
                  n: { $first: "$n_trips" },
                },
              },
              { $group: { _id: { taxon: "$_id.taxon", gear: "$_id.gear" }, trips: { $sum: "$n" } } },
            ],
          },
        },
      ]).exec(),
      TaxaTraitsModel.find(
        { $or: [{ length_maturity_cm: { $gt: 0 } }, { length_optimum_cm: { $gt: 0 } }] },
        { catch_taxon: 1, length_maturity_cm: 1, length_optimum_cm: 1 }
      ).lean(),
    ]);
    const measured = new Map<string, MeasuredCatch>();
    const of = ({ taxon, gear }: Id) =>
      entry(measured, `${taxon}|${gear}`, (): MeasuredCatch => ({ taxon, gear: gear ?? null, classes: [], trips: 0 }));
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
