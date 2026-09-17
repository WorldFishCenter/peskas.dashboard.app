import type { Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

// STAGE 2 STEP 2.7: Production portal audits on 2026-08-26 confirmed that the
// live taxa_summaries contract exposes exactly these three metrics in Mozambique,
// Kenya, and Zanzibar. Historical schema-only metrics are removed from the contract.
export const TAXA_METRICS = [
  "catch_kg",
  "mean_length",
  "price_kg",
] as const;

export type TTaxaMetric = (typeof TAXA_METRICS)[number] | string;

/* eslint-disable @typescript-eslint/consistent-type-definitions */
export type TTaxaSummaryDistrict = {
  _id: Types.ObjectId;
  gaul_2_name: string;
  catch_taxon: string;
  metric: TTaxaMetric;
  value?: number;
  // STAGE 2 STEP 2.7: `date` is present on every analytical taxa row in all three
  // production portal deployments and represents the monthly source-grain period.
  date: Date;
  scientific_name?: string;
  timestamp?: Date;
};

/**
 * Schema for taxa/species monthly summary statistics by district.
 */
const taxaSummaryDistrictSchema = new Schema<TTaxaSummaryDistrict>(
  {
    gaul_2_name: { type: String, required: true },
    catch_taxon: { type: String, required: true },
    metric: { type: String, required: true },
    value: { type: Number, required: false },
    // STAGE 2 STEP 2.7: Model the production-verified monthly date field so both
    // dashboard routers and AskFish can apply the visible time-range selector.
    date: { type: Date, required: true },
    scientific_name: String,
    timestamp: Date,
  },
  {
    collection: "taxa_summaries",
  },
);

// STAGE 2 STEP 2.7: Index the actual production semantic grain used by bounded
// composition queries. Existing single-dimension indexes are retained for lookup UX.
taxaSummaryDistrictSchema.index({ date: 1, gaul_2_name: 1, catch_taxon: 1, metric: 1 });
taxaSummaryDistrictSchema.index({ gaul_2_name: 1, catch_taxon: 1, metric: 1 });
taxaSummaryDistrictSchema.index({ catch_taxon: 1 });
taxaSummaryDistrictSchema.index({ timestamp: -1 });

/**
 * Model
 */
export const TaxaSummaryDistrictModel =
  (mongoose.models.TaxaSummaryDistrict as mongoose.Model<TTaxaSummaryDistrict>) ??
  mongoose.model<TTaxaSummaryDistrict>("TaxaSummaryDistrict", taxaSummaryDistrictSchema);
