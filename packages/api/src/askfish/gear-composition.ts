/**
 * Stage 4.2.A: deterministic, source-grain recorded gear/taxon catch composition.
 * Run AFTER the governed v1 query has applied country/scope/category constraints
 * and canonicalized source versions. Never compute shares over truncated frames.
 */
import { AskFishQueryError } from "./query";

type SemanticRow = {
  dimensions: Record<string, string | number | boolean>;
  value: number;
};
export type GearTaxaFrame = {
  dataset: string;
  measure: string;
  truncated: boolean;
  recordCount: number;
  matchedCanonicalRecordCount: number;
  records: SemanticRow[];
};

export function summarizeGearTaxaComposition(frame: GearTaxaFrame, topN = 10) {
  if (frame.dataset !== "gear_taxa_summaries" || frame.measure !== "catch_kg") {
    throw new AskFishQueryError("Gear composition requires the approved catch_kg measure.", 422);
  }
  if (frame.truncated || frame.recordCount !== frame.matchedCanonicalRecordCount ||
      frame.records.length !== frame.recordCount) {
    throw new AskFishQueryError(
      "Catch shares cannot be calculated from a truncated or incomplete query frame.", 413,
    );
  }
  if (!Number.isInteger(topN) || topN < 1 || topN > 20) {
    throw new AskFishQueryError("topN must be an integer from 1 to 20.", 422);
  }

  const totals = new Map<string, Map<string, number>>();
  let excludedNonpositive = 0;
  for (const record of frame.records) {
    const gear = record.dimensions.gear;
    const taxon = record.dimensions.taxon;
    if (typeof gear !== "string" || !gear.trim() ||
        typeof taxon !== "string" || !taxon.trim()) {
      throw new AskFishQueryError("A returned gear/taxon row lacks its declared grain.", 422);
    }
    if (!Number.isFinite(record.value)) {
      throw new AskFishQueryError("Non-finite catch value in source frame.", 422);
    }
    // Parity with the native summaries.gearComposition catch_kg > 0 predicate.
    if (record.value <= 0) {
      excludedNonpositive += 1;
      continue;
    }
    const taxa = totals.get(gear) ?? new Map<string, number>();
    taxa.set(taxon, (taxa.get(taxon) ?? 0) + record.value);
    totals.set(gear, taxa);
  }

  const gears = [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([gear, taxa]) => {
    const totalCatchKg = [...taxa.values()].reduce((a, b) => a + b, 0);
    if (!Number.isFinite(totalCatchKg) || totalCatchKg <= 0) {
      throw new AskFishQueryError("Invalid recorded catch denominator.", 422);
    }
    const allTaxa = [...taxa].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    // Important: the share denominator includes ALL matching taxa, not only top N.
    return {
      gear,
      totalCatchKg,
      taxonCount: allTaxa.length,
      taxa: allTaxa.slice(0, topN).map(([taxon, catchKg]) => ({
        taxon,
        catchKg,
        sharePercent: 100 * catchKg / totalCatchKg,
      })),
    };
  });

  return {
    methodId: "recorded_gear_taxon_catch_share_v1" as const,
    unit: "kg" as const,
    shareUnit: "%" as const,
    denominator: "all positive recorded catch for each selected, named gear across matching districts/months",
    excludedNonpositiveRecords: excludedNonpositive,
    gears,
    caveats: [
      "Recorded sampled catch only; not a fleet estimate or complete national catch.",
      "Source rows without named gear/taxon are excluded by the approved query grain; percentages describe the known-gear subset only.",
      "Kenya KEFS taxa may describe species sampled from a catch, not all landed catch.",
      "Trip counts (n_trips) are not read or summed because they repeat across taxa.",
    ],
  };
}
