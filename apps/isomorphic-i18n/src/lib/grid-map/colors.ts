import { TIME_BREAKS } from '@/lib/grid-map/config';
import type { TimeBreak } from '@/lib/grid-map/types';

// Sequential Blues palette (light → dark), used for the district choropleth.
export const CHOROPLETH_COLORS: [number, number, number][] = [
  [247, 251, 255],
  [198, 219, 239],
  [107, 174, 214],
  [33, 113, 181],
  [8, 69, 148],
  [8, 37, 82],
];

export function interpolateChoroplethColor(
  value: number,
  min: number,
  max: number
): [number, number, number, number] {
  if (min === max) return [...CHOROPLETH_COLORS[2], 180];
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const scaled = t * (CHOROPLETH_COLORS.length - 1);
  const lo = Math.floor(scaled);
  const hi = Math.min(lo + 1, CHOROPLETH_COLORS.length - 1);
  const frac = scaled - lo;
  const mix = (i: number) => Math.round(CHOROPLETH_COLORS[lo][i] * (1 - frac) + CHOROPLETH_COLORS[hi][i] * frac);
  return [mix(0), mix(1), mix(2), 180];
}

export const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
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
