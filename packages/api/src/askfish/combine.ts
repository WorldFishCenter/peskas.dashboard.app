import {
  combine,
  isMetricKey,
  METRIC_KEYS,
  METRICS,
  TAXA_METRICS,
  type Combine,
} from "@repo/domain/metrics";
import { GearSummaryDistrictModel } from "@repo/nosql/schema/gear-summary-district";
import { TaxaSummaryDistrictModel } from "@repo/nosql/schema/taxa-summary-district";
import {
  type Cells,
  districtCells,
  districtMetrics,
  groupCells,
  monthKey,
  monthlyCells,
  overWindow,
  scopeMatch,
  withTwin,
} from "../lib/cells";
import { scopeDistricts } from "../lib/country";

/** The districts (all of them when left out) and months a figure covers, and any gear or taxon picked. */
export type Selection = {
  districts?: string[];
  date: Record<string, Date> | null;
  gear?: string[];
  taxon?: string[];
};

/** A combined figure, by the dimensions kept (`district`, `month` as YYYY-MM-01, `gear`, `taxon`). */
export type Figure = { dimensions: Record<string, string>; value: number };

type Combined = (measure: string, keep: string[], sel: Selection) => Promise<Figure[]>;

/** One summary value and every dimension it is at (a dimension the summary leaves empty is null). */
type Row = {
  gaul_2_name: string;
  dims: Record<string, string | null>;
  field: string;
  value?: number | null;
};

const monthDay = (month: string) => `${month}-01`;

const figures = (rows: { dimensions: Record<string, string>; value: number | null }[]) =>
  rows.filter((r): r is Figure => r.value != null);

/** Rows combined into one figure per value of the kept dimensions, each cell (one value of every dimension) once. */
function groupFigures(rows: Row[], keep: string[], measure: string, how: Combine, weight?: string) {
  const groups = groupCells(
    rows,
    (r) =>
      JSON.stringify(
        Object.fromEntries(keep.flatMap((k) => (r.dims[k] == null ? [] : [[k, r.dims[k]]]))),
      ),
    (r) => r.field,
    (r) => JSON.stringify(r.dims),
  );
  return figures(
    [...groups].map(([key, byCell]) => {
      const cells = [...byCell.values()];
      return {
        dimensions: JSON.parse(key!),
        value: combine(
          cells.map((c) => c[measure]),
          how,
          weight ? cells.map((c) => c[weight]) : undefined,
        ),
      };
    }),
  );
}

const district =
  (read: (filter: object, keys: string[]) => Promise<Cells>): Combined =>
  async (measure, keep, sel) => {
    const cells = await read(
      scopeMatch(sel.districts, sel.date),
      isMetricKey(measure) ? withTwin(measure) : [measure],
    );
    if (!isMetricKey(measure)) {
      // The share of boats tracked: the pages show the plain mean of its district-months.
      const rows = [...cells].flatMap(([month, byDistrict]) =>
        [...byDistrict].map(([gaul_2_name, cell]) => ({
          gaul_2_name,
          dims: { district: gaul_2_name, month: monthDay(month) },
          field: measure,
          value: cell[measure],
        })),
      );
      return groupFigures(rows, keep, measure, "mean");
    }
    if (keep.includes("district")) {
      return figures(
        scopeDistricts(sel.districts).map((d) => ({
          dimensions: { district: d },
          value: districtMetrics(cells, d).metrics[measure],
        })),
      );
    }
    const { value, perMonth } = overWindow(cells, [...cells.keys()].sort(), measure);
    if (!keep.includes("month")) return figures([{ dimensions: {}, value }]);
    return figures(
      perMonth.map((p) => ({ dimensions: { month: monthDay(p.month) }, value: p.value })),
    );
  };

/** A gear indicator combines as the district metric it is (`gearIndicator`); landings as landings. */
const gearRule = (indicator: string) =>
  METRICS[METRIC_KEYS.find((k) => k === indicator || METRICS[k].gearIndicator === indicator)!]
    .overMonths;

const gears: Combined = async (measure, keep, sel) => {
  const docs = await GearSummaryDistrictModel.find({
    ...scopeMatch(sel.districts, sel.date),
    ...(sel.gear ? { gear: { $in: sel.gear } } : {}),
    indicator: { $in: [measure, "n_submissions"] },
  }).lean();
  const rows = docs.flatMap((d) =>
    d.date
      ? [
          {
            gaul_2_name: d.gaul_2_name,
            dims: {
              district: d.gaul_2_name,
              month: monthDay(monthKey(d.date)),
              gear: d.gear ?? null,
            },
            field: d.indicator,
            value: d.value,
          },
        ]
      : [],
  );
  return groupFigures(rows, keep, measure, gearRule(measure), "n_submissions");
};

const taxa: Combined = async (measure, keep, sel) => {
  const docs = await TaxaSummaryDistrictModel.find({
    ...scopeMatch(sel.districts, sel.date),
    ...(sel.taxon ? { catch_taxon: { $in: sel.taxon } } : {}),
    metric: { $in: [measure, "catch_kg"] },
  }).lean();
  const rows = docs.flatMap((d) =>
    d.date
      ? [
          {
            gaul_2_name: d.gaul_2_name,
            dims: {
              district: d.gaul_2_name,
              month: monthDay(monthKey(d.date)),
              taxon: d.catch_taxon,
            },
            field: d.metric,
            value: d.value,
          },
        ]
      : [],
  );
  const how = TAXA_METRICS[measure as keyof typeof TAXA_METRICS].overMonths;
  return groupFigures(rows, keep, measure, how, "catch_kg");
};

/** The portal datasets AskFish may combine, by catalog id, each by the pages' rules over every dimension but `keep`. */
export const COMBINED: Record<string, Combined | undefined> = {
  district_summary: district((filter, keys) => districtCells(filter, [...keys, "n_submissions"])),
  monthly_district_summary: district(
    async (filter, keys) => (await monthlyCells(filter, keys)).cells,
  ),
  gear_summary_district: gears,
  taxa_summary_district: taxa,
};
