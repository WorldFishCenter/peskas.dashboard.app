import type { Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-definitions */
export type TGearSummaryDistrict = {
  _id: Types.ObjectId;
  gaul_2_name: string;
  date?: Date;
  gear: string;
  indicator: string;
  value: number;
  timestamp?: Date;
};

/**
 * Schema for gear summary statistics by district
 */
const gearSummaryDistrictSchema = new Schema<TGearSummaryDistrict>(
  {
    gaul_2_name: { type: String, required: true },
    date: { type: Date, required: false },
    gear: { type: String, required: true },
    indicator: { type: String, required: true },
    value: { type: Number, required: true },
    timestamp: Date,
  },
  {
    collection: "gear_summaries",
  },
);

// Create compound index for efficient querying
gearSummaryDistrictSchema.index({ gaul_2_name: 1, gear: 1, indicator: 1 });
gearSummaryDistrictSchema.index({ timestamp: -1 });

/**
 * Model
 */
export const GearSummaryDistrictModel =
  (mongoose.models.GearSummaryDistrict as mongoose.Model<TGearSummaryDistrict>) ??
  mongoose.model<TGearSummaryDistrict>("GearSummaryDistrict", gearSummaryDistrictSchema); 