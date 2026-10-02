import type { Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-definitions */
/**
 * Recorded catch in one length class of one taxon, gear, district and month.
 * `n_trips` counts the trips behind the taxon, gear, district and month and is
 * repeated on each of its length classes. The open top class has no `length_max`.
 */
export type TLengthSummary = {
  _id: Types.ObjectId;
  gaul_2_name: string;
  date: Date;
  catch_taxon: string;
  gear?: string;
  length_min: number;
  length_max?: number;
  n_trips: number;
  catch_kg: number;
};

const lengthSummarySchema = new Schema<TLengthSummary>(
  {
    gaul_2_name: { type: String, required: true },
    date: { type: Date, required: true },
    catch_taxon: { type: String, required: true },
    gear: String,
    length_min: { type: Number, required: true },
    length_max: Number,
    n_trips: { type: Number, required: true },
    catch_kg: { type: Number, required: true },
  },
  { collection: "length_summaries" },
);

lengthSummarySchema.index({ gaul_2_name: 1, date: -1, catch_taxon: 1 });

export const LengthSummaryModel =
  (mongoose.models.LengthSummary as mongoose.Model<TLengthSummary>) ??
  mongoose.model<TLengthSummary>("LengthSummary", lengthSummarySchema);
