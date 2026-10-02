import { type Connection, type Model, Schema } from "mongoose";

export type TGaul2BoundaryGeometry = {
  type: string;
  coordinates: unknown;
};

/**
 * Flexible type covering both document shapes found in wio_gaul2:
 *
 * Flat format:
 *   { iso3_code, gaul1_name, gaul2_name, geometry }
 *
 * GeoJSON Feature format:
 *   { type: "Feature", properties: { iso3_code, gaul1_name, gaul2_name }, geometry }
 */
export type TGaul2Boundary = {
  // Flat format – primary field names
  iso3_code?: string;
  country?: string; // alternate country field used in some docs
  gaul1_name?: string;
  gaul_1_name?: string; // underscore variant
  gaul2_name?: string;
  gaul_2_name?: string; // underscore variant (coasts script normalises this)
  // GeoJSON Feature format fields
  type?: string;
  properties?: {
    iso3_code?: string;
    country?: string;
    gaul1_name?: string;
    gaul2_name?: string;
    [key: string]: unknown;
  };
  geometry: TGaul2BoundaryGeometry;
};

// strict: false allows Mongoose to read fields not declared in the schema
const gaul2BoundarySchema = new Schema<TGaul2Boundary>(
  {
    iso3_code: { type: String },
    country: { type: String },
    gaul1_name: { type: String },
    gaul_1_name: { type: String },
    gaul2_name: { type: String },
    gaul_2_name: { type: String },
    type: { type: String },
    properties: { type: Schema.Types.Mixed },
    geometry: { type: Schema.Types.Mixed, required: true },
  },
  {
    collection: "wio_gaul2",
    strict: false,
  },
);

gaul2BoundarySchema.index({ iso3_code: 1 });
gaul2BoundarySchema.index({ "properties.iso3_code": 1 });

/**
 * Returns a Mongoose model scoped to the given connection.
 * Using a factory avoids polluting the global model registry when
 * connecting to a secondary database (portal).
 */
export function getGaul2BoundariesModel(connection: Connection) {
  return (
    (connection.models["Gaul2Boundary"] as Model<TGaul2Boundary>) ??
    connection.model<TGaul2Boundary>("Gaul2Boundary", gaul2BoundarySchema)
  );
}
