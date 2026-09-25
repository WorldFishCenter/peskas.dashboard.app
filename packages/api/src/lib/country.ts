import { resolveCountry } from "@repo/domain/country";

/**
 * This deployment's country. The browser bundle bakes in the same
 * VITE_COUNTRY_CODE at build time; the server reads it per call, never at
 * module load.
 */
export const activeCountry = () => resolveCountry(process.env.VITE_COUNTRY_CODE);
