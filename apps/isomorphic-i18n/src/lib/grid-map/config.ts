import type { TimeBreak } from "@/lib/grid-map/types";

// Fishing hours per active day in a cell, summed over boats (the coasts portal's avg_hours_per_day).
export const TIME_BREAKS: TimeBreak[] = [
  { min: 0, max: 0.25, label: "0-0.25h" },
  { min: 0.25, max: 0.5, label: "0.25-0.5h" },
  { min: 0.5, max: 1, label: "0.5-1h" },
  { min: 1, max: 1.5, label: "1-1.5h" },
  { min: 1.5, max: 2, label: "1.5-2h" },
  { min: 2, max: Infinity, label: ">2h" },
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

// The effort map's opening camera angle (degrees), over each country's view state.
export const EFFORT_VIEW_ANGLE = { pitch: 35, bearing: 0 };

export const GRID_LAYER_SETTINGS = {
  opacity: 0.85,
  elevationAggregation: "MEAN" as const,
  // With elevationScale = cell width / 100, the tallest column is twice as high as it is wide.
  elevationRange: [0, 200] as [number, number],
  material: {
    ambient: 0.64,
    diffuse: 0.6,
    shininess: 32,
    specularColor: [51, 51, 51] as [number, number, number],
  },
};
