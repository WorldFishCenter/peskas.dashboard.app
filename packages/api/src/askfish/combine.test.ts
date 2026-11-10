import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import getDb from "@repo/nosql";
import { DistrictSummaryModel } from "@repo/nosql/schema/district-summary";
import { GearSummaryDistrictModel } from "@repo/nosql/schema/gear-summary-district";
import { MonthlySummaryDistrictModel } from "@repo/nosql/schema/monthly-summary-district";
import { TaxaSummaryDistrictModel } from "@repo/nosql/schema/taxa-summary-district";
import { TaxaTraitsModel } from "@repo/nosql/schema/taxa-traits";
import { monthKey } from "../lib/cells";
import { activeCountry } from "../lib/country";
import { monthWindow, windowStart } from "../lib/months";
import { summariesRouter } from "../router/summaries";
import { createCallerFactory } from "../trpc";
import { COMBINED, type Figure, type Selection } from "./combine";

const summaries = createCallerFactory(summariesRouter)({});

/** The month `ago` complete months back, the 1st in UTC: month(0) is last month. */
const month = (ago: number) => windowStart(ago + 1);

let mongod: MongoMemoryServer;
let scope: Selection;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.VITE_COUNTRY_CODE = "TZ";
  await getDb();
  scope = { districts: activeCountry().districts, date: monthWindow(windowStart(2)) };

  const district = (gaul_2_name: string, indicator: string, value: number, ago: number) => ({
    gaul_2_name,
    indicator,
    value,
    date: month(ago),
  });
  await DistrictSummaryModel.insertMany([
    district("Wete", "n_submissions", 10, 0),
    district("Wete", "mean_cpue", 1, 0),
    district("Wete", "estimated_catch_tn", 4, 0),
    district("Wete", "estimated_catch_tn_fao", 5, 0),
    district("Mkoani", "n_submissions", 30, 0),
    district("Mkoani", "mean_cpue", 3, 0),
    district("Mkoani", "estimated_catch_tn", 6, 0), // no ARTFISH twin: left out of shared totals
    district("Wete", "n_submissions", 20, 1),
    district("Wete", "mean_cpue", 3, 1),
    district("Wete", "estimated_catch_tn", 2, 1),
    district("Wete", "estimated_catch_tn_fao", 3, 1),
    district("Mkoani", "n_submissions", 10, 1),
    district("Mkoani", "mean_cpue", 1, 1),
    district("Mkoani", "estimated_catch_tn_fao", 7, 1),
  ]);
  // The trend's own collection. Mkoani's catch rate last month differs from districts_summaries,
  // as when two GAUL units share its name: coasts merges them here and not there.
  const monthly = (gaul_2_name: string, metric: string, value: number, ago: number) => ({
    gaul_2_name,
    metric,
    value,
    date: month(ago),
  });
  await MonthlySummaryDistrictModel.insertMany([
    monthly("Wete", "mean_cpue", 1, 0),
    monthly("Wete", "estimated_catch_tn", 4, 0),
    monthly("Wete", "estimated_catch_tn_fao", 5, 0),
    monthly("Mkoani", "mean_cpue", 5, 0),
    monthly("Mkoani", "estimated_catch_tn", 6, 0),
    monthly("Wete", "mean_cpue", 3, 1),
    monthly("Wete", "estimated_catch_tn", 2, 1),
    monthly("Wete", "estimated_catch_tn_fao", 3, 1),
    monthly("Mkoani", "mean_cpue", 1, 1),
    monthly("Mkoani", "estimated_catch_tn_fao", 7, 1),
  ]);
  const gear = (gaul_2_name: string, g: string, indicator: string, value: number, ago: number) => ({
    gaul_2_name,
    gear: g,
    indicator,
    value,
    date: month(ago),
  });
  await GearSummaryDistrictModel.insertMany([
    gear("Wete", "Gill Net", "cpue", 2, 0),
    gear("Wete", "Gill Net", "n_submissions", 4, 0),
    gear("Wete", "Gill Net", "cpue", 4, 1),
    gear("Wete", "Gill Net", "n_submissions", 1, 1),
    gear("Mkoani", "Gill Net", "cpue", 1, 0),
    gear("Mkoani", "Gill Net", "n_submissions", 5, 0),
    gear("Wete", "Hand Line", "cpue", 3, 0),
    gear("Wete", "Hand Line", "n_submissions", 2, 0),
  ]);
  const taxon = (
    gaul_2_name: string,
    catch_taxon: string,
    metric: string,
    value: number,
    ago: number,
  ) => ({
    gaul_2_name,
    catch_taxon,
    metric,
    value,
    date: month(ago),
  });
  await TaxaSummaryDistrictModel.insertMany([
    taxon("Wete", "Sardinella", "catch_kg", 10, 0),
    taxon("Wete", "Sardinella", "price_kg", 100, 0),
    taxon("Mkoani", "Sardinella", "catch_kg", 30, 0),
    taxon("Mkoani", "Sardinella", "price_kg", 200, 0),
    taxon("Wete", "Thunnus", "catch_kg", 5, 1),
    taxon("Wete", "Thunnus", "price_kg", 500, 1),
  ]);
  await TaxaTraitsModel.create({ alpha3_code: "SAX", catch_taxon: "Sardinella" });
}, 60_000);

afterAll(async () => {
  const connection = await getDb();
  await connection.disconnect();
  await mongod.stop();
});

const valueOf = (figures: Figure[], key: string, of: string) =>
  figures.find((f) => f.dimensions[key] === of)?.value;

test("a district over the months is the district table's figure", async () => {
  const table = await summaries.byDistrict({ months: 2 });
  for (const metric of ["mean_cpue", "estimated_catch_tn", "estimated_catch_tn_fao"] as const) {
    const figures = await COMBINED.district_summary!(metric, ["district"], scope);
    for (const row of table.filter((r) => r[metric] != null)) {
      expect(valueOf(figures, "district", row.district)).toBeCloseTo(row[metric]!);
    }
  }
  // Wete's catch rate weighted by landings: (1 × 10 + 3 × 20) / 30.
  const cpue = await COMBINED.district_summary!("mean_cpue", ["district"], scope);
  expect(valueOf(cpue, "district", "Wete")).toBeCloseTo(70 / 30);
});

test("the districts in a month are the trend line's figure, and all of it the headline's", async () => {
  const headline = (await summaries.headline({ months: 2 }))!;
  for (const metric of ["mean_cpue", "estimated_catch_tn"] as const) {
    const trend = await summaries.monthly({ metric, months: 2 });
    const points = trend.overall.filter((p) => p.value != null);
    expect(points).toHaveLength(2);
    const figures = await COMBINED.monthly_district_summary!(metric, ["month"], scope);
    for (const point of points) {
      expect(valueOf(figures, "month", `${point.month}-01`)).toBeCloseTo(point.value!);
    }
    const [total] = await COMBINED.district_summary!(metric, [], scope);
    expect(total!.value).toBeCloseTo(headline.metrics[metric].value!);
  }
  // Last month's rate from monthly_summaries, weighted by landings: (1 × 10 + 5 × 30) / 40.
  const cpue = await COMBINED.monthly_district_summary!("mean_cpue", ["month"], scope);
  expect(valueOf(cpue, "month", `${monthKey(month(0))}-01`)).toBeCloseTo(4);
  // Only the district-months both methods estimate: Wete's two months, not Mkoani's.
  const [catchTotal] = await COMBINED.monthly_district_summary!("estimated_catch_tn", [], scope);
  expect(catchTotal!.value).toBeCloseTo(6);
});

test("a gear's rate is the gear page's, weighted by its landings", async () => {
  const gears = await summaries.byGear({ months: 2 });
  const figures = await COMBINED.gear_summary_district!("cpue", ["gear"], scope);
  for (const g of gears) expect(valueOf(figures, "gear", g.gear!)).toBeCloseTo(g.cpue!);
  // Gill Net: (2 × 4 + 4 × 1 + 1 × 5) / 10.
  expect(valueOf(figures, "gear", "Gill Net")).toBeCloseTo(1.7);
});

test("a taxon's price is the species price, weighted by its catch", async () => {
  const { rows } = await summaries.speciesPrice({ months: 2 });
  const prices = await COMBINED.taxa_summary_district!("price_kg", ["taxon"], scope);
  const catches = await COMBINED.taxa_summary_district!("catch_kg", ["taxon"], scope);
  for (const row of rows) {
    expect(valueOf(prices, "taxon", row.taxon)).toBeCloseTo(row.price_kg);
    expect(valueOf(catches, "taxon", row.taxon)).toBeCloseTo(row.catch_kg);
  }
  expect(valueOf(prices, "taxon", "Sardinella")).toBeCloseTo((100 * 10 + 200 * 30) / 40);
});
