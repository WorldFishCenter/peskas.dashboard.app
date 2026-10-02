import type { Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-definitions */
/** Recorded catch of one taxon by one gear in a district and month, and the trips that landed it. */
export type TGearTaxaSummary = {
  _id: Types.ObjectId;
  gaul_2_name: string;
  date: Date;
  gear?: string;
  catch_taxon: string;
  catch_kg: number;
  n_trips: number;
};

const gearTaxaSummarySchema = new Schema<TGearTaxaSummary>(
  {
    gaul_2_name: { type: String, required: true },
    date: { type: Date, required: true },
    gear: String,
    catch_taxon: { type: String, required: true },
    catch_kg: { type: Number, required: true },
    n_trips: { type: Number, required: true },
  },
  { collection: "gear_taxa_summaries" },
);

gearTaxaSummarySchema.index({ gaul_2_name: 1, date: -1 });

export const GearTaxaSummaryModel =
  (mongoose.models.GearTaxaSummary as mongoose.Model<TGearTaxaSummary>) ??
  mongoose.model<TGearTaxaSummary>("GearTaxaSummary", gearTaxaSummarySchema);
