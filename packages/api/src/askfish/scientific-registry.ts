/**
 * AskFish 2.0 / 4.2.A: checked, opt-in scientific source contracts.
 *
 * This is NOT a database schema discovery -> authorization pipeline. A dataset
 * must be explicitly reviewed into scientific-registry.json and its complete
 * catalog definition must pass the same Zod validator as catalog v1. No free-form
 * Mongo filter, pipeline, join or new API data source is accepted here.
 */
import { z } from "zod";
import registryDocument from "./scientific-registry.json";

const scienceRulesSchema = z.object({
  grain: z.array(z.string().min(1)).min(1),
  population: z.string().min(1),
  additiveMeasures: z.array(z.string().min(1)).min(1),
  blockedMeasures: z.record(z.string().min(1)),
  positiveCatchOnlyForComposition: z.literal(true),
  shareDenominator: z.literal("all_matching_positive_catch_before_top_n"),
  provenance: z.string().min(1),
  requiredCoverage: z.literal("all_matching_source_rows_no_truncation"),
  permission: z.literal("local_opt_in_only"),
});

const registrySchema = z.object({
  registryVersion: z.string().min(1),
  featureFlag: z.literal("ASKFISH_V2_ENABLE_GEAR_TAXA"),
  status: z.literal("local_testing_only"),
  sourceEvidence: z.array(z.string().min(1)).min(1),
  scienceRules: z.record(scienceRulesSchema),
  // Explicit operator approval is metadata, not automatically inferred from Mongo fields.
  analysisCapabilities: z.record(z.object({
    operation: z.literal("composition"), dataset: z.string().min(1),
    measure: z.string().min(1), groupBy: z.string().min(1), partitionBy: z.string().min(1),
  allowedPartitionDimensions: z.array(z.string().min(1)).min(1).max(4).optional(),
  maxPartitionDimensions: z.number().int().min(1).max(3).optional(),
  maxPartitions: z.number().int().min(1).max(500).optional(),
    positiveOnly: z.literal(true), maxTopN: z.number().int().min(1).max(20),
    denominator: z.literal("sum_all_matching_positive_values_per_partition_before_top_n"),
    note: z.string().min(1),
  })),
  weightedMeanCapabilities: z.record(z.object({
    operation: z.literal("weighted_mean"),
    valueDataset: z.string().min(1), valueMeasure: z.string().min(1),
    weightDataset: z.string().min(1), weightMeasure: z.string().min(1),
    joinDimensions: z.array(z.string().min(1)).min(2),
    allowedGroupBy: z.array(z.string().min(1)).min(1),
    weightUnit: z.string().min(1),
    denominatorPolicy: z.literal("positive_matched_weights_only_complete_pairs"),
    status: z.literal("provisional_descriptive"), note: z.string().min(1),
  })).default({}),
  // The complete runtime shape is validated by semanticCatalogSchema after merge.
  datasets: z.record(z.unknown()),
});

export const scientificRegistry = registrySchema.parse(registryDocument);

/** Feature is disabled unless intentionally enabled in the LOCAL runtime. */
export function isAskFishV2GearTaxaEnabled() {
  return (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    process.env.ASKFISH_V2_ENABLE_GEAR_TAXA === "1";
}

/** A separate local-only flag keeps provisional weighting out of deployed catalogs. */
export function isAskFishV2WeightedMeanEnabled() {
  return (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    process.env.ASKFISH_V2_ENABLE_WEIGHTED_MEAN === "1";
}

/**
 * Optional weighted calculations must use actual semantic keys exposed by BOTH
 * source measures. A physical field named `date` does not make `date` a semantic
 * dimension when the generated dictionary advertises `month` instead.
 * This check is structural only; scientific denominator compatibility is separate.
 */
export function weightedMeanSourceCompatible(
  datasets: Record<string, {
    grain: string[];
    measures: Record<string, { nativeGrain: string[] }>;
  }>,
  capability: (typeof scientificRegistry.weightedMeanCapabilities)[string],
): boolean {
  const valueSource = datasets[capability.valueDataset];
  const weightSource = datasets[capability.weightDataset];
  const value = valueSource?.measures[capability.valueMeasure];
  const weight = weightSource?.measures[capability.weightMeasure];
  if (!valueSource || !weightSource || !value || !weight) return false;
  // A cross-dataset relationship needs additional explicit scientific approval.
  if (capability.valueDataset !== capability.weightDataset) return false;
  if (capability.allowedGroupBy.some((dim) => !capability.joinDimensions.includes(dim))) return false;
  return capability.joinDimensions.every((dim) =>
    valueSource.grain.includes(dim) && weightSource.grain.includes(dim) &&
    value.nativeGrain.includes(dim) && weight.nativeGrain.includes(dim));
}

/** Fail closed when a registry entry disagrees with its own science constraints. */
export function validateRegistrySemantics(
  datasets: Record<string, {
    grain: string[];
    measures: Record<string, { nativeGrain: string[]; unit: { value: string }; rollups: Record<string, { status: string; method?: string }> }>;
    pageScopes: string[];
  }>,
  options: { validateWeightedMean?: boolean } = {},
) {
  for (const [capabilityId, capability] of Object.entries(scientificRegistry.analysisCapabilities)) {
    const dataset = datasets[capability.dataset];
    const measure = dataset?.measures[capability.measure];
    if (!dataset || !measure || !dataset.grain.includes(capability.groupBy) ||
        !dataset.grain.includes(capability.partitionBy) || capability.groupBy === capability.partitionBy ||
        (capability.allowedPartitionDimensions ?? [capability.partitionBy]).some((dimension) =>
          !dataset.grain.includes(dimension) || dimension === capability.groupBy) ||
        (capability.maxPartitionDimensions ?? 1) > (capability.allowedPartitionDimensions ?? [capability.partitionBy]).length) {
      throw new Error(`Invalid analytical capability ${capabilityId}`);
    }
    if (measure.rollups["acrossTaxon"]?.method !== "sum" ||
        Object.values(measure.rollups).some((rollup) => rollup.status === "allowed" && rollup.method !== "sum")) {
      throw new Error(`Non-additive analytical capability ${capabilityId}`);
    }
    const rule = scientificRegistry.scienceRules[capability.dataset];
    if (!rule?.additiveMeasures.includes(capability.measure) || !rule.positiveCatchOnlyForComposition) {
      throw new Error(`Missing scientific approval for ${capabilityId}`);
    }
  }
  if (options.validateWeightedMean === true) {
    for (const [capabilityId, capability] of Object.entries(scientificRegistry.weightedMeanCapabilities)) {
      if (!weightedMeanSourceCompatible(datasets, capability)) {
        throw new Error(`Invalid weighted mean source contract ${capabilityId}`);
      }
    }
  }
  for (const [datasetId, rules] of Object.entries(scientificRegistry.scienceRules)) {
    const dataset = datasets[datasetId];
    if (!dataset) throw new Error(`Scientific registry has no catalog dataset ${datasetId}`);
    if (JSON.stringify(dataset.grain) !== JSON.stringify(rules.grain)) {
      throw new Error(`Scientific registry grain mismatch for ${datasetId}`);
    }
    // Stage 4.2.A only enables this first capability in unrestricted mode.
    if (dataset.pageScopes.length > 0) throw new Error(`Unreviewed page scope for ${datasetId}`);
    for (const measure of rules.additiveMeasures) {
      const definition = dataset.measures[measure];
      if (!definition) throw new Error(`Approved additive measure ${datasetId}.${measure} is missing`);
      if (definition.unit.value !== "kg") throw new Error(`Unexpected catch unit for ${datasetId}.${measure}`);
      for (const rollup of Object.values(definition.rollups)) {
        if (rollup.status === "allowed" && rollup.method !== "sum") {
          throw new Error(`Invalid additive reduction for ${datasetId}.${measure}`);
        }
      }
    }
    for (const blockedMeasure of Object.keys(rules.blockedMeasures)) {
      if (dataset.measures[blockedMeasure]) {
        throw new Error(`Non-additive ${datasetId}.${blockedMeasure} exposed to queries`);
      }
    }
  }
}
