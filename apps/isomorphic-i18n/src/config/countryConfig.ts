import { resolveCountry } from '@repo/domain/country';

/** This deployment's country, fixed at build time by VITE_COUNTRY_CODE (default TZ). */
export const activeCountry = resolveCountry(import.meta.env.VITE_COUNTRY_CODE);
