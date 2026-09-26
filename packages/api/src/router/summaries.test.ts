import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import getDb from "@repo/nosql";
import { DistrictSummaryModel } from "@repo/nosql/schema/district-summary";
import { GearSummaryDistrictModel } from "@repo/nosql/schema/gear-summary-district";
import { MonthlySummaryDistrictModel } from "@repo/nosql/schema/monthly-summary-district";
import { TaxaSummaryDistrictModel } from "@repo/nosql/schema/taxa-summary-district";
import { createCallerFactory } from "../trpc";
import { summariesRouter } from "./summaries";

const summaries = createCallerFactory(summariesRouter)({});

/** The month `ago` months before this one, dated as coasts dates it: the 1st, in UTC. */
function month(ago: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - ago, 1));
}
const key = (ago: number) => month(ago).toISOString().slice(0, 7);

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.VITE_COUNTRY_CODE = "TZ"; // Wete and Mkoani are in Pemba, Mjini in Unguja
  await getDb();

  const district = (gaul_2_name: string, indicator: string, value: number, ago: number) =>
    ({ gaul_2_name, indicator, value, date: month(ago) });
  await DistrictSummaryModel.insertMany([
    district("Wete", "n_submissions", 10, 0),
    district("Mkoani", "n_submissions", 30, 0),
    district("Wete", "n_fishers", 5, 0),
    district("Mkoani", "n_fishers", 7, 0),
    district("Wete", "mean_cpue", 1, 0),
    district("Mkoani", "mean_cpue", 3, 0),
    district("Wete", "n_submissions", 20, 1),
    district("Wete", "mean_cpue", 3, 1),
    district("Wete", "n_submissions", 100, 5), // outside a 3-month window
  ]);

  const monthly = (gaul_2_name: string, value: number, ago: number) =>
    ({ gaul_2_name, metric: "mean_cpue", value, date: month(ago) });
  await MonthlySummaryDistrictModel.insertMany([monthly("Wete", 1, 0), monthly("Wete", 2, 1), monthly("Wete", 3, 12)]);

  await GearSummaryDistrictModel.insertMany([
    { gaul_2_name: "Wete", gear: "Gill Net", indicator: "cpue", value: 2, date: month(0) },
    { gaul_2_name: "Wete", gear: "Gill Net", indicator: "rpue", value: 500, date: month(0) },
  ]);

  const taxa = (gaul_2_name: string, metric: string, value: number, ago: number) =>
    ({ gaul_2_name, catch_taxon: "Octopus cyanea", metric, value, date: month(ago) });
  await TaxaSummaryDistrictModel.insertMany([
    taxa("Wete", "catch_kg", 10, 0),
    taxa("Wete", "catch_kg", 20, 1),
    taxa("Wete", "mean_length", 30, 0),
    taxa("Wete", "mean_length", 50, 1),
    taxa("Mkoani", "catch_kg", 5, 0),
  ]);
}, 120_000);

afterAll(async () => {
  await (await getDb()).disconnect();
  await mongod?.stop();
});

test("region cards add up totals and fisher counts, and average rates", async () => {
  const trend = await summaries.regionTrend({ months: 3 });
  expect(trend.n_submissions.map((row) => row.month)).toEqual([key(1), key(0)]);
  expect(trend.n_submissions.at(-1)).toMatchObject({ Pemba: 40 }); // 10 + 30, never their mean
  expect(trend.n_fishers.at(-1)).toMatchObject({ Pemba: 12 });
  expect(trend.mean_cpue.at(-1)).toMatchObject({ Pemba: 2 });
});

test("a district's totals add up across the window and its rates average", async () => {
  expect(await summaries.byDistrict({ districts: ["Wete"], months: 3 })).toEqual([
    expect.objectContaining({ district: "Wete", n_submissions: 30, mean_cpue: 2, estimated_catch_tn: null }),
  ]);
  const [allTime] = await summaries.byDistrict({ districts: ["Wete"] });
  expect(allTime.n_submissions).toBe(130);
});

test("districts outside the country are refused; an empty selection gives no rows", async () => {
  await expect(summaries.byDistrict({ districts: ["Nyali"] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(await summaries.monthly({ districts: [], metric: "mean_cpue" })).toEqual([]);
  await expect(summaries.monthly({ metric: "n_fishers" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("monthly rows are keyed YYYY-MM; seasonality averages a calendar month across years", async () => {
  expect(await summaries.monthly({ districts: ["Wete"], metric: "mean_cpue", months: 3 })).toEqual([
    { month: key(1), Wete: 2 },
    { month: key(0), Wete: 1 },
  ]);
  const season = await summaries.seasonality({ districts: ["Wete"], metric: "mean_cpue" });
  expect(season).toHaveLength(12);
  expect(season.find((row) => row.month === month(0).getUTCMonth() + 1)).toEqual({
    month: month(0).getUTCMonth() + 1,
    Wete: 2, // this month (1) and the same month last year (3)
  });
});

test("gear rows read the gear summaries' name for the metric", async () => {
  expect(await summaries.byGear({ districts: ["Wete"], metric: "mean_cpue" })).toEqual([
    { gear: "Gill Net", value: 2, records: 1, districts: 1 },
  ]);
});

test("taxa sum catch and average length across months; composition adds districts up", async () => {
  expect(await summaries.taxa({ districts: ["Wete"], metrics: ["catch_kg", "mean_length"], months: 3 })).toEqual([
    { district: "Wete", taxon: "Octopus cyanea", catch_kg: 30, mean_length: 40 },
  ]);
  const [octopus] = await summaries.composition({ districts: ["Wete", "Mkoani"], metric: "catch_kg", months: 3 });
  expect(octopus).toMatchObject({ taxon: "Octopus cyanea", total: 35 });
});
