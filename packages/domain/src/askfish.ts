import type { MetricKey } from "./metrics";

/**
 * AskFish's pages, under its own names, with the page metrics it accepts (`ask_data`, `integrations/peskas.py`). The data
 * routes check its catch-trends calls and page-restricted queries against them.
 */
export const ASKFISH_PAGES = {
  catch_trends: {
    operation: "catch_trends.monthly_time_series.v1",
    metrics: ["mean_cpue", "mean_catch_kg", "estimated_catch_tn", "estimated_fishing_trips"],
  },
  revenue: {
    metrics: ["mean_rpue", "mean_catch_price", "mean_price_kg", "estimated_revenue"],
  },
} as const satisfies Record<string, { operation?: string; metrics: readonly MetricKey[] }>;

/** The longest month window AskFish takes. */
export const ASKFISH_MAX_MONTHS = 72;

/** How long a question AskFish takes, in characters. */
export const ASKFISH_QUESTION = { min: 2, max: 1000 } as const;
