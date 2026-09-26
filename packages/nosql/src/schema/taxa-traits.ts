import type { Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-definitions */
/**
 * One taxon the country has landed, with the FishBase traits coasts summarises
 * for its taxon code (`summarise_taxa_traits()`). A family-level code spans many
 * species: vulnerability is their median and range, and the species-level
 * fields (IUCN category, lengths at maturity and optimum) are set only for one-species codes.
 * Every trait is missing when FishBase had nothing for the code.
 */
export type TTaxaTraits = {
  _id: Types.ObjectId;
  alpha3_code: string;
  catch_taxon: string;
  english_name?: string;
  n_species?: number;
  vulnerability?: number;
  vulnerability_min?: number;
  vulnerability_max?: number;
  trophic_level?: number;
  n_threatened?: number;
  n_cites?: number;
  iucn_code?: string;
  length_maturity_cm?: number;
  length_optimum_cm?: number;
  class?: string;
};

const taxaTraitsSchema = new Schema<TTaxaTraits>(
  {
    alpha3_code: { type: String, required: true },
    catch_taxon: { type: String, required: true },
    english_name: String,
    n_species: Number,
    vulnerability: Number,
    vulnerability_min: Number,
    vulnerability_max: Number,
    trophic_level: Number,
    n_threatened: Number,
    n_cites: Number,
    iucn_code: String,
    length_maturity_cm: Number,
    length_optimum_cm: Number,
    class: String,
  },
  { collection: "taxa_traits" },
);

export const TaxaTraitsModel =
  (mongoose.models.TaxaTraits as mongoose.Model<TTaxaTraits>) ??
  mongoose.model<TTaxaTraits>("TaxaTraits", taxaTraitsSchema);
