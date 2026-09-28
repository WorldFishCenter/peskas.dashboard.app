import { type Connection, type Model, Schema } from "mongoose";

/**
 * Fishing effort predicted from the GPS tracks, as the coasts portal shows it
 * (`export_pds_spatial` in peskas.coasts), with a `country` on every document.
 */
export type TPdsEffortCell = {
  h3_index: string;
  country: string;
  fishing_hours: number;
  unique_trips: number;
  n_active_days: number;
  avg_hours_per_day: number;
  /** The cell centre. */
  lng: number;
  lat: number;
};

export type TPdsFishingGround = {
  ground_id: string;
  country: string;
  area_km2: number;
  unique_trips: number;
  avg_hours_per_day: number;
  geometry: { type: string; coordinates: unknown };
};

const effortCellSchema = new Schema<TPdsEffortCell>(
  { country: { type: String } },
  { collection: "pds_effort", strict: false },
);

const fishingGroundSchema = new Schema<TPdsFishingGround>(
  { country: { type: String } },
  { collection: "pds_fishing_grounds", strict: false },
);

/** Models on the coasts connection (`getPortalDb`), like the GAUL2 boundaries. */
export function getPdsEffortModel(connection: Connection) {
  return (
    (connection.models["PdsEffortCell"] as Model<TPdsEffortCell>) ??
    connection.model<TPdsEffortCell>("PdsEffortCell", effortCellSchema)
  );
}

export function getPdsFishingGroundsModel(connection: Connection) {
  return (
    (connection.models["PdsFishingGround"] as Model<TPdsFishingGround>) ??
    connection.model<TPdsFishingGround>("PdsFishingGround", fishingGroundSchema)
  );
}
