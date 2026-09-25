import { activeCountry } from '@/config/countryConfig';

// Country-specific district colours, with an 11-colour fallback cycled by index.
export const DISTRICT_COLORS: Record<string, string> = activeCountry.districtColors;

export const DISTRICT_COLOR_PALETTE = [
  '#167288', '#8cdaec', '#b45248', '#d48c84', '#a89a49',
  '#d6cfa2', '#3cb464', '#9bddb1', '#643c6a', '#836394', '#90a4ae',
];

export const getDistrictColor = (district: string, index: number) =>
  DISTRICT_COLORS[district] || DISTRICT_COLOR_PALETTE[index % DISTRICT_COLOR_PALETTE.length];

/** Selected districts that appear in any data point, in selection order, with their colours. */
export function districtSeries(points: Record<string, unknown>[], districts: string[]) {
  const present = new Set(points.flatMap((point) => Object.keys(point)));
  return districts.filter((d) => present.has(d)).map((d, i) => ({ key: d, color: getDistrictColor(d, i) }));
}

// Top-species colours; "Others" always uses OTHERS_COLOR.
export const SPECIES_COLORS = [
  '#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#F97316', '#14B8A6', '#EC4899', '#84CC16', '#6366F1', '#F472B6',
];
export const OTHERS_COLOR = '#9CA3AF';

export const TREEMAP_COLORS = [
  '#167288', '#3cb464', '#b45248', '#a89a49', '#643c6a', '#8cdaec',
  '#9bddb1', '#d48c84', '#d6cfa2', '#836394', '#00B4D8', '#F97316',
];

// Box plot fills: Q1 → median, median → Q3.
export const BOX_LOWER_COLOR = '#96ACB7';
export const BOX_UPPER_COLOR = '#CA1551';

// YlGnBu-8, used by the heatmap tables.
export const YLGNBU_8 = [
  '#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb',
  '#41b6c4', '#1d91c0', '#225ea8', '#253494',
];

export function getPaletteColor(value: number | null, min: number, max: number) {
  if (value === null || isNaN(value)) return YLGNBU_8[0];
  if (max === min) return YLGNBU_8[YLGNBU_8.length - 1];
  const idx = Math.floor(((value - min) / (max - min)) * (YLGNBU_8.length - 1));
  return YLGNBU_8[idx];
}

/** Dark or light text, whichever reads better on the given hex background. */
export function getTextColor(bgColor: string) {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#222' : '#fff';
}
