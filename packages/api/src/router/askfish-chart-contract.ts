import { z } from "zod";

const point = z.object({
  x: z.union([z.string(), z.number()]),
  y: z.number(),
  label: z.string().nullish(),
  z: z.number().finite().positive().optional(), // Bubble size, third measure
});


/** A chart as AskFish describes it: plain series, drawn by the dashboard's own charts. */
export const askFishChartSchema = z.object({
  type: z.string(),
  title: z.string(),
  xLabel: z.string().nullish(),
  yLabel: z.string().nullish(),
  sizeLabel: z.string().nullish(),
  sizeUnit: z.string().nullish(),
  note: z.string().nullish(),
  referenceLines: z.array(z.unknown()).nullish(),
  series: z.array(
    z.object({ name: z.string(), role: z.string().nullish(), points: z.array(point) }),
  ),
});

