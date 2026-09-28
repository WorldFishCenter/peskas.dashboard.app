import { TIME_BREAKS } from "@/lib/grid-map/config";
import type { TimeBreak } from "@/lib/grid-map/types";

// The portal's one-hue magnitude ramp (hue 225°, light → dark), as in the tint tokens of globals.css.
export const CHOROPLETH_COLORS: [number, number, number][] = [
  [228, 245, 252],
  [195, 228, 242],
  [146, 206, 231],
  [86, 178, 212],
  [14, 148, 186],
  [0, 117, 150],
  [0, 89, 117],
];

/** A ramp for the basemap: light to dark on a light map, dark to light on a dark one, so more always stands out. */
export const forTheme = <T>(ramp: T[], dark: boolean) => (dark ? [...ramp].reverse() : ramp);

export function interpolateChoroplethColor(
  value: number,
  min: number,
  max: number,
  colors: [number, number, number][] = CHOROPLETH_COLORS,
): [number, number, number, number] {
  if (min === max) return [...colors[2], 180];
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const scaled = t * (colors.length - 1);
  const lo = Math.floor(scaled);
  const hi = Math.min(lo + 1, colors.length - 1);
  const frac = scaled - lo;
  const mix = (i: number) => Math.round(colors[lo][i] * (1 - frac) + colors[hi][i] * frac);
  return [mix(0), mix(1), mix(2), 180];
}

export const MAP_STYLES = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-v9",
};

/** Whether an average-hours value falls in an effort band (upper bound exclusive). */
export const isInBreak = (value: number, range: TimeBreak) =>
  value >= range.min && (range.max === Infinity || value < range.max);

/** Index into TIME_BREAKS / COLOR_RANGE for an average-hours value. */
export function getColorForValue(value: number): number {
  for (let i = TIME_BREAKS.length - 1; i >= 0; i--) {
    if (isInBreak(value, TIME_BREAKS[i])) return i;
  }
  return 0;
}
