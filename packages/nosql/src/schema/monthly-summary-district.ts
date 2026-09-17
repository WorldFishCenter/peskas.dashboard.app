import type { Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

// Define metrics for monthly summaries
export const MONTHLY_METRICS = [
  "mean_cpue",
  "mean_rpue", 
  "mean_price_kg",
  "mean_catch_kg",
  "mean_catch_price",
  "estimated_fishing_trips",
  "estimated_catch_tn",
  "estimated_revenue",
] as const;


export type TMonthlyMetric = (typeof MONTHLY_METRICS)[number] | string;

/* eslint-disable @typescript-eslint/consistent-type-definitions */
export type TMonthlySummaryDistrict = {
  _id: Types.ObjectId;
  gaul_2_name: string;
  date: Date;
  metric: TMonthlyMetric;
  value: number;
  timestamp?: Date;
};

/**
 * Schema for monthly summary statistics by district
 */
const monthlySummaryDistrictSchema = new Schema<TMonthlySummaryDistrict>(
  {
    gaul_2_name: { type: String, required: true },
    date: { type: Date, required: true },
    metric: { type: String, required: true },
    value: { type: Number, required: true },
    timestamp: Date,
  },
  {
    collection: "monthly_summaries",
  },
);

// Create compound index for efficient querying
monthlySummaryDistrictSchema.index({ gaul_2_name: 1, date: -1, metric: 1 });
monthlySummaryDistrictSchema.index({ date: -1 });

/**
 * Model
 */
export const MonthlySummaryDistrictModel =
  (mongoose.models.MonthlySummaryDistrict as mongoose.Model<TMonthlySummaryDistrict>) ??
  mongoose.model<TMonthlySummaryDistrict>("MonthlySummaryDistrict", monthlySummaryDistrictSchema); 