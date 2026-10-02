import { DistrictMultiples } from "@/components/charts/district-multiples";
import { MetricTrend } from "@/components/charts/metric-trend";
import { SeasonalityHeatmap } from "@/components/charts/seasonality-heatmap";
import { MetricPicker } from "@/components/dashboard/headline";
import type { PageMetric } from "@/config/routes";
import { usePageMetric } from "@/store/filters";

/**
 * Catch and revenue pages: the page's measures as tiles (the one picked is
 * charted), its trend against a year earlier, each district on its own, and
 * the month-of-year pattern once there are two years of data.
 */
export function MetricAnalysis({ metric: page }: { metric: PageMetric }) {
  const [metric] = usePageMetric(page);

  return (
    <>
      <MetricPicker page={page} />
      <MetricTrend metric={metric} />
      <DistrictMultiples metric={metric} />
      <SeasonalityHeatmap metric={metric} />
    </>
  );
}
