import type { MetricKey, TaxaMetricKey } from "./metrics";

/**
 * What AskFish knows of the dashboard: the pages a question can come from,
 * under AskFish's own names, the operation it runs on each and the page
 * metrics it accepts. These are AskFish's lists (`ask_data`,
 * `integrations/peskas.py`): it refuses anything else, so a page metric
 * missing here can't be asked about until AskFish adds it.
 */
export const ASKFISH_PAGES = {
  catch_trends: {
    operation: "catch_trends.monthly_time_series.v1",
    metrics: ["mean_cpue", "estimated_catch_tn"],
  },
  revenue: {
    operation: "dashboard.semantic_context.v1",
    metrics: ["mean_rpue", "estimated_revenue"],
  },
  // No metric picker on the page: its one measure, catch by species.
  catch_composition: {
    operation: "dashboard.semantic_context.v1",
    metrics: ["catch_kg"],
  },
} as const satisfies Record<
  string,
  { operation: string; metrics: readonly (MetricKey | TaxaMetricKey)[] }
>;

export type AskFishPage = keyof typeof ASKFISH_PAGES;
export const ASKFISH_PAGE_IDS = Object.keys(ASKFISH_PAGES) as [AskFishPage, ...AskFishPage[]];

/** Whether AskFish takes a question about `metric` on `page`. */
export const askFishKnows = (page: AskFishPage, metric: string) =>
  (ASKFISH_PAGES[page].metrics as readonly string[]).includes(metric);

/** The longest month window AskFish takes. */
export const ASKFISH_MAX_MONTHS = 72;

/** How long a question AskFish takes, in characters. */
export const ASKFISH_QUESTION = { min: 2, max: 1000 } as const;
