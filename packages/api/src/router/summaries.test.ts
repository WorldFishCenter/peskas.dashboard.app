import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import getDb from "@repo/nosql";
import { DistrictSummaryModel } from "@repo/nosql/schema/district-summary";
import { GearSummaryDistrictModel } from "@repo/nosql/schema/gear-summary-district";
import { GearTaxaSummaryModel } from "@repo/nosql/schema/gear-taxa-summary";
import { LengthSummaryModel } from "@repo/nosql/schema/length-summary";
import { MonthlySummaryDistrictModel } from "@repo/nosql/schema/monthly-summary-district";
import { TaxaSummaryDistrictModel } from "@repo/nosql/schema/taxa-summary-district";
import { TaxaTraitsModel } from "@repo/nosql/schema/taxa-traits";
import { createCallerFactory } from "../trpc";
import { summariesRouter } from "./summaries";

const summaries = createCallerFactory(summariesRouter)({});

/**
 * The month `ago` complete months back, dated as coasts dates it: the 1st, in
 * UTC. month(0) is last month, the latest a window covers; month(-1) is this
 * month, which no window covers while its landings come in.
 */
function month(ago: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - ago - 1, 1));
}
const key = (ago: number) => month(ago).toISOString().slice(0, 7);
const pushedAt = new Date("2026-09-20T06:00:00Z");

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.VITE_COUNTRY_CODE = "TZ"; // Wete and Mkoani are in Pemba, Mjini in Unguja
  await getDb();

  const district = (gaul_2_name: string, indicator: string, value: number, ago: number) => ({
    gaul_2_name,
    indicator,
    value,
    date: month(ago),
  });
  await DistrictSummaryModel.insertMany([
    district("Wete", "n_submissions", 10, 0),
    district("Mkoani", "n_submissions", 30, 0),
    district("Wete", "n_fishers", 5, 0),
    district("Mkoani", "n_fishers", 7, 0),
    district("Wete", "mean_cpue", 1, 0),
    district("Mkoani", "mean_cpue", 3, 0),
    district("Wete", "sampling_rate", 0.2, 0),
    district("Wete", "n_submissions", 20, 1),
    district("Wete", "mean_cpue", 3, 1),
    district("Wete", "sampling_rate", 0.4, 1),
    district("Wete", "estimated_catch_tn", 4, 1),
    district("Mjini", "n_submissions", 10, 1),
    district("Mjini", "mean_cpue", 1, 1),
    district("Mjini", "estimated_catch_tn", 6, 1),
    district("Wete", "estimated_catch_tn", 5, 13), // the same month a year earlier
    district("Wete", "n_submissions", 100, 5), // outside a 3-month window
    district("Kati", "n_submissions", 3, 0), // too few landings to rely on
    district("Micheweni", "n_submissions", 12, 12), // a year ago, nothing since
    district("Dar es Salaam", "n_submissions", 4, 0), // not a Zanzibar district
    district("Wete", "n_submissions", 999, -1), // this month, still coming in
    district("Wete", "estimated_catch_tn", 999, -1),
  ]);
  // coasts' push writes a metadata document into every collection, its fields as one-element arrays.
  await DistrictSummaryModel.collection.insertOne({
    type: ["metadata"],
    columns: [],
    timestamp: [pushedAt],
  });

  const monthly = (gaul_2_name: string, value: number, ago: number) => ({
    gaul_2_name,
    metric: "mean_cpue",
    value,
    date: month(ago),
  });
  await MonthlySummaryDistrictModel.insertMany([
    monthly("Wete", 1, 0),
    monthly("Wete", 2, 1),
    monthly("Wete", 3, 12),
  ]);

  const gear = (gaul_2_name: string, name: string, indicator: string, value: number) => ({
    gaul_2_name,
    gear: name,
    indicator,
    value,
    date: month(0),
  });
  await GearSummaryDistrictModel.insertMany([
    gear("Wete", "Gill Net", "n_submissions", 4),
    gear("Wete", "Gill Net", "cpue", 2),
    gear("Wete", "Gill Net", "rpue", 500),
    gear("Mkoani", "Gill Net", "n_submissions", 1),
    gear("Mkoani", "Gill Net", "cpue", 7),
    gear("Wete", "Hand Line", "n_submissions", 10),
    gear("Wete", "Hand Line", "cpue", 1),
  ]);

  const taxa = (
    gaul_2_name: string,
    metric: string,
    value: number,
    ago: number,
    catch_taxon = "Octopus cyanea",
  ) => ({ gaul_2_name, catch_taxon, metric, value, date: month(ago) });
  await TaxaSummaryDistrictModel.insertMany([
    taxa("Wete", "catch_kg", 10, 0),
    taxa("Wete", "catch_kg", 20, 1),
    taxa("Wete", "mean_length", 30, 0),
    taxa("Wete", "mean_length", 50, 1),
    taxa("Wete", "price_kg", 1000, 0),
    taxa("Wete", "price_kg", 2000, 1),
    taxa("Mkoani", "catch_kg", 5, 0),
    taxa("Wete", "catch_kg", 10, 0, "Carcharhinidae"),
  ]);

  await TaxaTraitsModel.insertMany([
    {
      alpha3_code: "OCC",
      catch_taxon: "Octopus cyanea",
      english_name: "Big blue octopus",
      vulnerability: 12,
      trophic_level: 3.5,
      class: "Cephalopoda",
      length_maturity_cm: 20,
      length_optimum_cm: 30,
    },
    {
      alpha3_code: "RSK",
      catch_taxon: "Carcharhinidae",
      vulnerability: 82,
      trophic_level: 4.3,
      class: "Elasmobranchii",
      n_species: 31,
      n_threatened: 22,
    },
  ]);

  const length = (gaul_2_name: string, length_min: number, catch_kg: number, n_trips: number) => ({
    gaul_2_name,
    date: month(0),
    catch_taxon: "Octopus cyanea",
    gear: "Spear",
    length_min,
    length_max: length_min + 5,
    catch_kg,
    n_trips,
  });
  await LengthSummaryModel.insertMany([
    length("Wete", 10, 2, 3),
    length("Wete", 20, 6, 3),
    length("Mkoani", 10, 1, 2),
  ]);

  const gearTaxa = (gaul_2_name: string, gear: string, catch_taxon: string, catch_kg: number) => ({
    gaul_2_name,
    date: month(0),
    gear,
    catch_taxon,
    catch_kg,
    n_trips: 1,
  });
  await GearTaxaSummaryModel.insertMany([
    gearTaxa("Wete", "Spear", "Octopus cyanea", 8),
    gearTaxa("Mkoani", "Spear", "Octopus cyanea", 2),
    gearTaxa("Wete", "Gill Net", "Carcharhinidae", 5),
  ]);
}, 120_000);

afterAll(async () => {
  await (await getDb()).disconnect();
  await mongod?.stop();
});

test("a district's totals add up across the window and its rates are weighted by landings", async () => {
  const [wete] = await summaries.byDistrict({ districts: ["Wete"], months: 3 });
  expect(wete).toMatchObject({ district: "Wete", n_submissions: 30, estimated_catch_tn: 4 });
  expect(wete.sampling_rate).toBeCloseTo(0.3);
  expect(wete.mean_cpue).toBeCloseTo((1 * 10 + 3 * 20) / 30); // never the plain mean, 2
  const [allTime] = await summaries.byDistrict({ districts: ["Wete"] });
  expect(allTime.n_submissions).toBe(130); // not this month's 999
  expect(allTime.previous).toBeNull();

  // The same three months a year earlier.
  const [lastYear] = await summaries.byDistrict({ districts: ["Wete"], months: 3 });
  expect(lastYear.previous).toMatchObject({ estimated_catch_tn: 5, n_submissions: null });
});

test("the headline covers complete months against the same months a year earlier", async () => {
  const headline = (await summaries.headline({ months: 3 }))!;
  expect(headline.window).toEqual({ start: key(2), end: key(0) }); // this month's 999s are left out
  expect(headline.previous).toEqual({ start: key(14), end: key(12) });
  expect(headline.samplingRate).toBeCloseTo(0.3);

  const {
    estimated_catch_tn: estimated,
    mean_cpue: cpue,
    n_submissions: landings,
  } = headline.metrics;
  expect(estimated).toMatchObject({ value: 10, previous: 5 });
  // Each month's districts weighted by their landings, then the months by theirs.
  expect(cpue.value).toBeCloseTo(
    (((1 * 10 + 3 * 30) / 40) * 40 + ((3 * 20 + 1 * 10) / 30) * 30) / 70,
  );
  expect(landings.value).toBe(73);
  expect(estimated.series.map((p) => p.month)).toEqual([key(2), key(1), key(0)]);

  const allTime = (await summaries.headline({}))!;
  expect(allTime.previous).toBeNull();
  expect(allTime.window.start).toBe(key(13));

  // Surveyed a year earlier and not since: no data, however full the year before is.
  expect(await summaries.headline({ districts: ["Micheweni"], months: 3 })).toBeNull();

  // Scoped to Pemba's districts, Mjini's catch is left out.
  const pemba = (await summaries.headline({ districts: ["Wete", "Mkoani"], months: 3 }))!;
  expect(pemba.metrics.estimated_catch_tn).toMatchObject({ value: 4, previous: 5 });
});

test("districts outside the country are refused; an empty selection gives no rows", async () => {
  await expect(summaries.byDistrict({ districts: ["Nyali"] })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect(await summaries.monthly({ districts: [], metric: "mean_cpue" })).toEqual({
    rows: [],
    thin: [],
    overall: [],
  });
  await expect(summaries.monthly({ metric: "n_fishers" })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

test("monthly rows are keyed YYYY-MM; seasonality averages a calendar month across every year", async () => {
  expect(await summaries.monthly({ districts: ["Wete"], metric: "mean_cpue", months: 3 })).toEqual({
    rows: [
      { month: key(1), Wete: 2 },
      { month: key(0), Wete: 1 },
    ],
    thin: [], // Wete had 10 and 20 landings
    // The same month a year earlier comes from outside the window.
    overall: [
      { month: key(1), value: 2, previous: null },
      { month: key(0), value: 1, previous: 3 },
    ],
  });
  const kati = await summaries.monthly({
    districts: ["Kati", "Mjini"],
    metric: "mean_cpue",
    months: 3,
  });
  expect(kati.thin).toEqual([`${key(0)}|Kati`]); // Mjini's 10 landings are enough
  const season = await summaries.seasonality({ districts: ["Wete"], metric: "mean_cpue" });
  expect(season.months).toBe(3);
  expect(season.rows).toHaveLength(12);
  expect(season.rows.find((row) => row.month === month(0).getUTCMonth() + 1)).toEqual({
    month: month(0).getUTCMonth() + 1,
    Wete: 2, // this month (1) and the same month last year (3)
  });
});

test("gears are ranked by landings and their rates weighted by them", async () => {
  expect(await summaries.byGear({ districts: ["Wete", "Mkoani"] })).toEqual([
    { gear: "Hand Line", landings: 10, cpue: 1, rpue: null },
    { gear: "Gill Net", landings: 5, cpue: (2 * 4 + 7 * 1) / 5, rpue: 500 },
  ]);
});

test("coverage counts landings, the latest month and the last push", async () => {
  const coverage = await summaries.coverage({ districts: ["Wete"], months: 3 });
  expect(coverage).toMatchObject({
    landings: 30,
    districts: 1,
    through: key(0),
    updatedAt: pushedAt,
  });
  expect(coverage.cells).toContainEqual({ district: "Wete", month: key(1), landings: 20 });
  // Landings the registry has no district for are named, never counted.
  expect(coverage.unlisted).toEqual(["Dar es Salaam"]);
  expect((await summaries.coverage({ months: 3 })).landings).toBe(73); // without Dar es Salaam's 4
});

test("taxa sum catch and average length across months; composition adds districts up", async () => {
  const taxa = await summaries.taxa({
    districts: ["Wete"],
    metrics: ["catch_kg", "mean_length"],
    months: 3,
  });
  expect(taxa).toHaveLength(2);
  expect(taxa).toEqual(
    expect.arrayContaining([
      { district: "Wete", taxon: "Carcharhinidae", catch_kg: 10 },
      { district: "Wete", taxon: "Octopus cyanea", catch_kg: 30, mean_length: 40 },
    ]),
  );
  const [octopus] = await summaries.composition({
    districts: ["Wete", "Mkoani"],
    metric: "catch_kg",
    months: 3,
  });
  expect(octopus).toMatchObject({ taxon: "Octopus cyanea", total: 35 });
});

test("gear composition adds a taxon's catch up per gear", async () => {
  const { available, rows } = await summaries.gearComposition({
    districts: ["Wete", "Mkoani"],
    months: 3,
  });
  expect(available).toBe(true);
  expect(rows[0]).toEqual({
    taxon: "Octopus cyanea",
    total: 10,
    groups: [{ group: "Spear", value: 10 }],
  });
  expect(rows[1]).toMatchObject({ taxon: "Carcharhinidae", total: 5 });
});

test("a species' price is weighted by the catch it was paid for", async () => {
  const { available, rows } = await summaries.speciesPrice({ districts: ["Wete"], months: 3 });
  expect(available).toBe(true);
  const [octopus] = rows;
  expect(octopus.taxon).toBe("Octopus cyanea");
  expect(octopus.price_kg).toBeCloseTo((1000 * 10 + 2000 * 20) / 30);
});

test("species traits split the recorded catch by vulnerability, sharks and trophic level", async () => {
  const traits = await summaries.speciesTraits({ districts: ["Wete", "Mkoani"], months: 3 });
  expect(traits.coverage).toBe(100);
  // The shark family is 10 of the 45 kg over the window, and the only very vulnerable taxon.
  expect(traits.window.high).toBeCloseTo((100 * 10) / 45);
  expect(traits.window.sharks_rays).toBeCloseTo((100 * 10) / 45);
  const thisMonth = traits.months.find((m) => m.month === key(0))!;
  expect(thisMonth).toMatchObject({
    catch_kg: 25,
    low: 60,
    very_high: 40,
    unknown: 0,
    sharks_rays: 40,
  });
  expect(thisMonth.trophic_level).toBeCloseTo((3.5 * 15 + 4.3 * 10) / 25);
  expect(traits.species[0]).toMatchObject({
    taxon: "Octopus cyanea",
    catch_kg: 35,
    vulnerability: 12,
  });
  expect(traits.species[1]).toMatchObject({
    taxon: "Carcharhinidae",
    sharks_rays: true,
    n_threatened: 22,
  });
});

test("species names come from the taxa traits", async () => {
  expect(await summaries.speciesNames()).toEqual({ "Octopus cyanea": "Big blue octopus" });
});

test("lengths add up classes across districts and count each district's trips once", async () => {
  const lengths = await summaries.lengths({ districts: ["Wete", "Mkoani"], months: 3 });
  expect(lengths.measured).toEqual([
    {
      taxon: "Octopus cyanea",
      gear: "Spear",
      trips: 5,
      classes: expect.arrayContaining([
        { length_min: 10, length_max: 15, catch_kg: 3 },
        { length_min: 20, length_max: 25, catch_kg: 6 },
      ]),
    },
  ]);
  expect(lengths.maturity).toEqual({ "Octopus cyanea": 20 });
  expect(lengths.optimum).toEqual({ "Octopus cyanea": 30 });
  expect(lengths.available).toBe(true);
});

// A portal database coasts wrote before 4.15.0 has neither traits nor lengths,
// and its species prices divide a whole trip's value by one taxon's weight.
test("before coasts 4.15.0 the species views say so instead of drawing old prices", async () => {
  const traits = await TaxaTraitsModel.find().lean();
  const lengths = await LengthSummaryModel.find().lean();
  await TaxaTraitsModel.deleteMany({});
  await LengthSummaryModel.deleteMany({});
  try {
    expect(await summaries.speciesPrice({ districts: ["Wete"] })).toEqual({
      available: false,
      rows: [],
    });
    expect((await summaries.lengths({ districts: ["Wete"] })).available).toBe(false);
    const species = await summaries.speciesTraits({ districts: ["Wete"] });
    expect(species).toMatchObject({ traitsAvailable: false, coverage: 0 });
  } finally {
    await TaxaTraitsModel.insertMany(traits);
    await LengthSummaryModel.insertMany(lengths);
  }
});
