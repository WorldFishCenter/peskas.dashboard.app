import { activeCountry } from "@/config/countryConfig";

const breakdown = activeCountry.features.regionBreakdown;

/** Regions in display order: regionBreakdown when the country defines it, else districtToRegion's values. */
export const REGIONS: string[] =
  breakdown?.regions ?? Array.from(new Set(Object.values(activeCountry.districtToRegion))).sort();

export const ALL_DISTRICTS = [...activeCountry.districts].sort((a, b) => a.localeCompare(b));

/** Districts grouped by region, for the region-grouped pickers. */
export const REGION_GROUPS = REGIONS.map((region) => ({
  value: region,
  items: ALL_DISTRICTS.filter((d) => activeCountry.districtToRegion[d] === region),
})).filter((group) => group.items.length > 0);

/** A region's name in the page language: "North" is translated, a place name like "Pemba" is not. */
export const regionLabel = (
  t: (key: string, options?: Record<string, unknown>) => string,
  region: string,
) => t(`region-${region}`, { defaultValue: region });

/** What a district selection is, in words: all districts, a region, one district, or how many. */
export function selectionLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  districts: string[],
) {
  if (districts.length === ALL_DISTRICTS.length) return t("text-all-districts");
  if (districts.length === 0) return t("text-no-districts");
  const region = REGION_GROUPS.find(
    (g) => g.items.length === districts.length && g.items.every((d) => districts.includes(d)),
  );
  if (region) return regionLabel(t, region.value);
  return districts.length <= 3
    ? districts.join(", ")
    : t("text-n-districts", { count: districts.length });
}
