import type { TimeBreak } from '@/lib/grid-map/types';

// Average time spent per 1 km grid cell, in hours.
export const TIME_BREAKS: TimeBreak[] = [
  { min: 0, max: 0.5, label: '0-0.5h' },
  { min: 0.5, max: 1, label: '0.5-1h' },
  { min: 1, max: 2, label: '1-2h' },
  { min: 2, max: 3, label: '2-3h' },
  { min: 3, max: 5, label: '3-5h' },
  { min: 5, max: Infinity, label: '>5h' },
];

// YlGnBu, one colour per TIME_BREAKS entry.
export const COLOR_RANGE: [number, number, number][] = [
  [255, 255, 217],
  [237, 248, 177],
  [199, 233, 180],
  [127, 205, 187],
  [65, 182, 196],
  [29, 145, 192],
];

export const GRID_LAYER_SETTINGS = {
  cellSize: 1000,
  opacity: 0.3,
  elevationAggregation: 'MEAN' as const,
  elevationScale: 100,
  elevationRange: [0, 200] as [number, number],
  material: {
    ambient: 0.64,
    diffuse: 0.6,
    shininess: 32,
    specularColor: [51, 51, 51] as [number, number, number],
  },
};
