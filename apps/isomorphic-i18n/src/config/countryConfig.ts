import { COUNTRY_REGISTRY, type CountryConfig } from './countries';

/**
 * The active country configuration for this deployment.
 * Resolved at build time from the VITE_COUNTRY_CODE env var.
 * Defaults to 'TZ' (Zanzibar) when VITE_COUNTRY_CODE is unset or unknown.
 */
export const activeCountry: CountryConfig =
  COUNTRY_REGISTRY[import.meta.env.VITE_COUNTRY_CODE ?? 'TZ'] ?? COUNTRY_REGISTRY.TZ;
