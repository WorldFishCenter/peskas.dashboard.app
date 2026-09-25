import { createTRPCRouter, publicProcedure } from "../trpc";
import { getGaul2BoundariesModel } from "@repo/nosql/schema/gaul2-boundaries";
import { getPortalDb } from "@repo/nosql";
import { activeCountry } from "../lib/country";

const GEO_TYPES = new Set([
  "Point", "LineString", "Polygon",
  "MultiPoint", "MultiLineString", "MultiPolygon", "GeometryCollection",
]);

function isGeoJsonGeometry(v: unknown): v is { type: string; coordinates: unknown } {
  return (
    typeof v === "object" && v !== null &&
    typeof (v as Record<string, unknown>).type === "string" &&
    GEO_TYPES.has((v as Record<string, unknown>).type as string) &&
    "coordinates" in (v as Record<string, unknown>)
  );
}

/**
 * Extract the GeoJSON geometry from a document regardless of which field
 * it lives in.  Most documents use `geometry` (GeoJSON spec), but some
 * MongoDB collections use `the_geom`, `geom`, or other names.
 */
function extractGeometry(doc: Record<string, unknown>): { type: string; coordinates: unknown } | null {
  // Standard GeoJSON field name
  if (isGeoJsonGeometry(doc.geometry)) return doc.geometry;
  // Search all top-level fields
  for (const [key, val] of Object.entries(doc)) {
    if (key !== "_id" && key !== "type" && key !== "properties" && isGeoJsonGeometry(val)) {
      return val;
    }
  }
  return null;
}

/**
 * Normalise a raw wio_gaul2 document into a consistent shape.
 * The coasts fetch script (fetchMongoData.js) normalises:
 *   iso3_code  → country    (field rename, value may be alpha-2 or alpha-3)
 *   gaul_2_name → gaul2_name (underscore variant)
 * We apply the same normalisations here so the GeoJSON properties
 * always have `gaul2_name` regardless of how the raw document is stored.
 */
function normalizeDoc(doc: Record<string, unknown>) {
  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = doc[k] ?? (doc.properties as Record<string, unknown> | undefined)?.[k];
      if (typeof v === "string" && v) return v;
    }
    return null;
  };
  return {
    gaul2_name: get("gaul2_name", "gaul_2_name"),
    gaul1_name: get("gaul1_name", "gaul_1_name"),
    iso3_code: get("iso3_code", "country"),
    geometry: extractGeometry(doc),
  };
}

export const gaul2BoundariesRouter = createTRPCRouter({
  /**
   * Returns the active country's GAUL2 boundaries as a GeoJSON FeatureCollection.
   *
   * Tries every combination of field name + value that the wio_gaul2 collection
   * might use, mirroring the coasts fetchMongoData.js normalisation logic:
   *   - field: iso3_code | country | properties.iso3_code | properties.country
   *   - value: alpha-3 (TZA) | alpha-2 (TZ)
   *
   * Falls back to fetching ALL documents and filtering in JS if the targeted
   * query returns nothing (matches the coasts approach of find({})).
   */
  getByCountry: publicProcedure
    .query(async () => {
      const conn = await getPortalDb();
      const Model = getGaul2BoundariesModel(conn);

      const { iso3Code, countryCode } = activeCountry();
      const codesToTry = [iso3Code, countryCode];

      // All field + value combinations to search
      const orClauses = codesToTry.flatMap((code) => [
        { iso3_code: code },
        { country: code },
        { "properties.iso3_code": code },
        { "properties.country": code },
      ]);

      let docs = await Model.find({ $or: orClauses }).lean() as Record<string, unknown>[];

      // Fallback: if nothing matched, fetch all and filter in JS
      // (mirrors what the coasts fetchMongoData.js script does)
      if (docs.length === 0) {
        const all = await Model.find({}).lean() as Record<string, unknown>[];
        docs = all.filter((doc) => {
          const norm = normalizeDoc(doc);
          return norm.iso3_code !== null && codesToTry.includes(norm.iso3_code);
        });
      }

      const features = docs
        .map((doc) => {
          const norm = normalizeDoc(doc);
          if (!norm.geometry) return null;
          return {
            type: "Feature" as const,
            geometry: norm.geometry,
            properties: {
              district: norm.gaul2_name,
              gaul1_name: norm.gaul1_name,
              iso3_code: norm.iso3_code,
            },
          };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);

      return {
        type: "FeatureCollection" as const,
        features,
      };
    }),

});
