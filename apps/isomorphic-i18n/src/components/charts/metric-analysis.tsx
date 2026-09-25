import { useAtomValue } from "jotai";
import { GearTreemap } from "@/components/charts/gear-treemap";
import { MetricRadar } from "@/components/charts/metric-radar";
import { MetricTimeSeries } from "@/components/charts/metric-time-series";
import type { PageMetric } from "@/config/routes";

/** Catch and revenue pages: time series and seasonality for the header metric, plus the gear treemap. */
export function MetricAnalysis({ metric: page }: { metric: PageMetric }) {
  const metric = useAtomValue(page.atom);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <MetricTimeSeries metric={metric} className="lg:col-span-8" />
        <MetricRadar metric={metric} className="lg:col-span-4" />
      </div>
      <GearTreemap metric={page.gear} />
    </>
  );
}
