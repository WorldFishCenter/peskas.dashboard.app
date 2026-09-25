import { activeCountry } from '@/config/countryConfig';
import { DISTRICT_COLOR_PALETTE } from '@/lib/dashboard/palettes';

const breakdown = activeCountry.features.regionBreakdown;

/** Regions in display order: regionBreakdown when the country defines it, else districtToRegion's values. */
export const REGIONS: string[] =
  breakdown?.regions ?? Array.from(new Set(Object.values(activeCountry.districtToRegion))).sort();

export const REGION_COLORS: Record<string, string> =
  breakdown?.colors ??
  Object.fromEntries(REGIONS.map((r, i) => [r, DISTRICT_COLOR_PALETTE[i % DISTRICT_COLOR_PALETTE.length]]));

export const ALL_DISTRICTS = [...activeCountry.districts].sort((a, b) => a.localeCompare(b));

/** Districts grouped by region, for the region-grouped pickers. */
export const REGION_GROUPS = REGIONS.map((region) => ({
  value: region,
  items: ALL_DISTRICTS.filter((d) => activeCountry.districtToRegion[d] === region),
})).filter((group) => group.items.length > 0);
