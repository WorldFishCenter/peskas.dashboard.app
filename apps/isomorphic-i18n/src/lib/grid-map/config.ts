import type { TimeBreak } from "@/lib/grid-map/types";

// Average time spent per 1 km grid cell, in hours.
export const TIME_BREAKS: TimeBreak[] = [
  { min: 0, max: 0.5, label: "0-0.5h" },
  { min: 0.5, max: 1, label: "0.5-1h" },
  { min: 1, max: 2, label: "1-2h" },
  { min: 2, max: 3, label: "2-3h" },
  { min: 3, max: 5, label: "3-5h" },
  { min: 5, max: Infinity, label: ">5h" },
];

// One colour per TIME_BREAKS entry, the choropleth's ramp without its palest step.
export const COLOR_RANGE: [number, number, number][] = [
  [195, 228, 242],
  [146, 206, 231],
  [86, 178, 212],
  [14, 148, 186],
  [0, 117, 150],
  [0, 89, 117],
];

export const GRID_LAYER_SETTINGS = {
  opacity: 0.85,
  elevationAggregation: "MEAN" as const,
  elevationScale: 100,
  elevationRange: [0, 200] as [number, number],
  material: {
    ambient: 0.64,
    diffuse: 0.6,
    shininess: 32,
    specularColor: [51, 51, 51] as [number, number, number],
  },
};
