import { afterEach, expect, test } from "vitest";
import { scientificRegistry, isAskFishV2GearTaxaEnabled, validateRegistrySemantics } from "./scientific-registry";
import { semanticCatalog, semanticCatalogForCountry } from "./semantic-catalog";
import { summarizeGearTaxaComposition } from "./gear-composition";

const oldFlag = process.env.ASKFISH_V2_ENABLE_GEAR_TAXA;
const oldNodeEnv = process.env.NODE_ENV;
afterEach(() => {
  if (oldFlag === undefined) delete process.env.ASKFISH_V2_ENABLE_GEAR_TAXA;
  else process.env.ASKFISH_V2_ENABLE_GEAR_TAXA = oldFlag;
  if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = oldNodeEnv;
});

test("registry source is reviewed and non-additive trip counts remain blocked", () => {
  const d = semanticCatalog.datasets.gear_taxa_summaries!;
  expect(scientificRegistry.status).toBe("local_testing_only");
  expect(d.layout).toBe("wide");
  expect(d.queryPolicy.canonicalKey).toEqual(["district", "month", "gear", "taxon"]);
  expect(Object.keys(d.measures)).toEqual(["catch_kg"]);
  expect(d.measures.n_trips).toBeUndefined();
  expect(d.pageScopes).toEqual([]);
  expect(d.measures.catch_kg!.rollups.acrossTaxon!.method).toBe("sum");
  expect(() => validateRegistrySemantics({
    gear_taxa_summaries: {
      ...d,
      measures: { ...d.measures, n_trips: d.measures.catch_kg! },
    },
  })).toThrow(/Non-additive/);
});

test("feature flag cannot expose preview in production and no country gains another country's records", () => {
  delete process.env.ASKFISH_V2_ENABLE_GEAR_TAXA;
  expect(isAskFishV2GearTaxaEnabled()).toBe(false);
  for (const country of ["KE", "TZ", "MZ"]) {
    expect(semanticCatalogForCountry(country).datasets.gear_taxa_summaries).toBeUndefined();
  }
  process.env.ASKFISH_V2_ENABLE_GEAR_TAXA = "1";
  process.env.NODE_ENV = "production";
  expect(isAskFishV2GearTaxaEnabled()).toBe(false);
  process.env.NODE_ENV = "test";
  for (const country of ["KE", "TZ", "MZ"]) {
    const view = semanticCatalogForCountry(country);
    expect(view.datasets.gear_taxa_summaries.binding.database).toBe("portal-prod");
    expect(Object.keys(view.datasets.gear_taxa_summaries)).not.toContain("bindings");
    expect(view.datasets.gear_taxa_summaries.binding).toEqual(
      semanticCatalog.datasets.gear_taxa_summaries!.bindings[country],
    );
  }
});

test("mean crew size and mean trip duration are not described as unique fishers/total effort", () => {
  const d = semanticCatalog.datasets.district_summary!;
  expect(d.measures.n_fishers!.label).toMatch(/mean crew/i);
  expect(d.measures.n_fishers!.rollups.acrossDistrict!.status).toBe("forbidden");
  expect(d.measures.n_fishers!.rollups.sum!.status).toBe("forbidden");
  expect(d.measures.trip_duration_hrs!.label).toMatch(/mean duration/i);
  expect(d.measures.trip_duration_hrs!.rollups.sum!.status).toBe("forbidden");
});

const frame = (records: Array<{ gear: string; taxon: string; value: number }>, truncated = false) => ({
  dataset: "gear_taxa_summaries",
  measure: "catch_kg",
  truncated,
  recordCount: records.length,
  matchedCanonicalRecordCount: records.length,
  records: records.map(({ gear, taxon, value }) => ({ dimensions: { gear, taxon }, value })),
});

test("composition sums all positive catch before ranking and percentage shares", () => {
  const result = summarizeGearTaxaComposition(frame([
    { gear: "Gill Net", taxon: "A", value: 20 },
    { gear: "Gill Net", taxon: "A", value: 10 },
    { gear: "Gill Net", taxon: "B", value: 15 },
    { gear: "Gill Net", taxon: "C", value: 5 },
    { gear: "Hand Line", taxon: "A", value: 7 },
    { gear: "Gill Net", taxon: "D", value: 0 },
  ]), 1);
  const gill = result.gears.find((g) => g.gear === "Gill Net")!;
  expect(gill.totalCatchKg).toBe(50);
  expect(gill.taxonCount).toBe(3);
  expect(gill.taxa).toEqual([{ taxon: "A", catchKg: 30, sharePercent: 60 }]);
  expect(result.excludedNonpositiveRecords).toBe(1);
  expect(result.gears.find((g) => g.gear === "Hand Line")!.taxa[0]!.sharePercent).toBe(100);
});

test("truncated, invalid and wrong-measure frames fail closed", () => {
  const records = [{ gear: "Gill Net", taxon: "A", value: 10 }];
  expect(() => summarizeGearTaxaComposition(frame(records, true))).toThrow(/truncated/);
  expect(() => summarizeGearTaxaComposition({ ...frame(records), measure: "n_trips" })).toThrow(/approved/);
  expect(() => summarizeGearTaxaComposition({ ...frame(records), matchedCanonicalRecordCount: 2 })).toThrow(/incomplete/);
  expect(() => summarizeGearTaxaComposition(frame(records), 30)).toThrow(/topN/);
  expect(() => summarizeGearTaxaComposition(frame([{ gear: "", taxon: "A", value: 10 }]))).toThrow(/grain/);
});


test("Stage 4.2.B advertises only reviewed analytical operators for enabled sources", () => {
  const id = "recorded_catch_composition_v1";
  const capability = scientificRegistry.analysisCapabilities[id];
  expect(capability).toMatchObject({
    operation: "composition", dataset: "gear_taxa_summaries",
    measure: "catch_kg", groupBy: "taxon", partitionBy: "gear",
    maxTopN: 20,
  });
  delete process.env.ASKFISH_V2_ENABLE_GEAR_TAXA;
  expect(semanticCatalogForCountry("TZ").analysisCapabilities[id]).toBeUndefined();
  process.env.NODE_ENV = "development";
  process.env.ASKFISH_V2_ENABLE_GEAR_TAXA = "1";
  for (const country of ["TZ", "KE", "MZ"]) {
    const deployment = semanticCatalogForCountry(country);
    expect(deployment.analysisCapabilities[id]).toEqual(capability);
    expect(deployment.datasets.gear_taxa_summaries).toBeDefined();
  }
  const original = semanticCatalog.datasets.gear_taxa_summaries!;
  expect(() => validateRegistrySemantics({
    gear_taxa_summaries: { ...original,
      measures: { catch_kg: { ...original.measures.catch_kg!, rollups: {
        ...original.measures.catch_kg!.rollups,
        acrossTaxon: { status: "allowed", method: "unweighted_mean" },
      } } },
    },
  })).toThrow(/Non-additive|Invalid additive/);
});

const oldWeightedFlag = process.env.ASKFISH_V2_ENABLE_WEIGHTED_MEAN;
afterEach(() => {
  if (oldWeightedFlag === undefined) delete process.env.ASKFISH_V2_ENABLE_WEIGHTED_MEAN;
  else process.env.ASKFISH_V2_ENABLE_WEIGHTED_MEAN = oldWeightedFlag;
});

test("generalized composition advertises approved partition dimensions only", () => {
  const approved = scientificRegistry.analysisCapabilities.recorded_catch_composition_v1!;
  expect(approved.allowedPartitionDimensions).toEqual(["gear", "district", "month"]);
  expect(approved.maxPartitionDimensions).toBe(2);
  expect(approved.maxPartitions).toBe(96);
  expect(approved.allowedPartitionDimensions).not.toContain("taxon");
});

test("submission-weighted descriptive source remains local opt-in and country-scoped", () => {
  const id = "recorded_catch_submission_weighted_v1";
  delete process.env.ASKFISH_V2_ENABLE_WEIGHTED_MEAN;
  expect(semanticCatalogForCountry("TZ").weightedMeanCapabilities[id]).toBeUndefined();
  expect(semanticCatalogForCountry("TZ").datasets.district_summary.measures.mean_catch_kg).toBeUndefined();
  process.env.NODE_ENV = "production";
  process.env.ASKFISH_V2_ENABLE_WEIGHTED_MEAN = "1";
  expect(semanticCatalogForCountry("TZ").weightedMeanCapabilities[id]).toBeUndefined();
  process.env.NODE_ENV = "test";
  for (const country of ["TZ", "KE", "MZ"]) {
    const view = semanticCatalogForCountry(country);
    expect(view.weightedMeanCapabilities[id]).toBeDefined();
    expect(view.datasets.district_summary.measures.mean_catch_kg).toBeDefined();
    expect(view.weightedMeanCapabilities[id].status).toBe("provisional_descriptive");
    expect(view.datasets.district_summary.binding).toEqual(
      semanticCatalog.datasets.district_summary.bindings[country],
    );
  }
});
