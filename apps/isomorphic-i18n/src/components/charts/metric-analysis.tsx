import { useAtomValue } from "jotai";
import { MetricTimeSeries } from "@/components/charts/metric-time-series";
import { SeasonalityHeatmap } from "@/components/charts/seasonality-heatmap";
import type { PageMetric } from "@/config/routes";

/** Catch and value pages: time series and seasonality for the header metric. */
export function MetricAnalysis({ metric: page }: { metric: PageMetric }) {
  const metric = useAtomValue(page.atom);

  return (
    <>
      <MetricTimeSeries metric={metric} />
      <SeasonalityHeatmap metric={metric} />
    </>
  );
}
