import type { Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-definitions */
export type TDistrictSummary = {
  _id: Types.ObjectId;
  gaul_2_name: string;
  indicator: string;
  value: number;
  date: Date;
  timestamp?: Date;
  metadata?: {
    period?: string; // e.g., "monthly", "weekly", "daily"
    startDate?: Date;
    endDate?: Date;
  };
};

/**
 * Schema for district summary statistics
 */
const districtSummarySchema = new Schema<TDistrictSummary>(
  {
    gaul_2_name: { type: String, required: true },
    indicator: { type: String, required: true },
    value: { type: Number, required: true },
    date: { type: Date, required: true },
    timestamp: Date,
    metadata: {
      period: String,
      startDate: Date,
      endDate: Date,
    },
  },
  {
    collection: "districts_summaries",
  },
);

// Create compound index for efficient querying
districtSummarySchema.index({ gaul_2_name: 1, indicator: 1 });
districtSummarySchema.index({ timestamp: -1 });

/**
 * Model
 */
export const DistrictSummaryModel =
  (mongoose.models.DistrictSummary as mongoose.Model<TDistrictSummary>) ??
  mongoose.model<TDistrictSummary>("DistrictSummary", districtSummarySchema); 