import type { Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-definitions */
export type TTaxaSummaryDistrict = {
  _id: Types.ObjectId;
  gaul_2_name: string;
  catch_taxon: string;
  metric: string;
  value?: number; // Optional as some values might be null
  scientific_name?: string; // Optional field for scientific names
  date?: Date; // Month the summary covers
  timestamp?: Date;
};

/**
 * Schema for taxa/species summary statistics by district
 */
const taxaSummaryDistrictSchema = new Schema<TTaxaSummaryDistrict>(
  {
    gaul_2_name: { type: String, required: true },
    catch_taxon: { type: String, required: true },
    metric: { type: String, required: true },
    value: { type: Number, required: false }, // Not required as it can be null
    scientific_name: String,
    date: Date,
    timestamp: Date,
  },
  {
    collection: "taxa_summaries",
  },
);

// Create compound index for efficient querying
taxaSummaryDistrictSchema.index({ gaul_2_name: 1, catch_taxon: 1, metric: 1 });
taxaSummaryDistrictSchema.index({ catch_taxon: 1 });
taxaSummaryDistrictSchema.index({ timestamp: -1 });

/**
 * Model
 */
export const TaxaSummaryDistrictModel =
  (mongoose.models.TaxaSummaryDistrict as mongoose.Model<TTaxaSummaryDistrict>) ??
  mongoose.model<TTaxaSummaryDistrict>("TaxaSummaryDistrict", taxaSummaryDistrictSchema); 