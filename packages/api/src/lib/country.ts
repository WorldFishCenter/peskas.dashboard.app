import { TRPCError } from "@trpc/server";
import { resolveCountry } from "@repo/domain/country";

/**
 * This deployment's country. The browser bundle bakes in the same
 * VITE_COUNTRY_CODE at build time; the server reads it per call, never at
 * module load.
 */
export const activeCountry = () => resolveCountry(process.env.VITE_COUNTRY_CODE);

/** Districts in scope, checked against the active country; all of them when left out. */
export function scopeDistricts(districts?: string[]) {
  const known = activeCountry().districts;
  const unknown = districts?.filter((d) => !known.includes(d)) ?? [];
  if (unknown.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Unknown districts: ${unknown.join(", ")}`,
    });
  }
  return districts ?? known;
}
