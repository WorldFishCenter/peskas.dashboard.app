"use client";

import { useAtomValue, type Atom } from "jotai";
import { GearTreemap } from "@/components/charts/gear-treemap";
import { MetricRadar } from "@/components/charts/metric-radar";
import { MetricTimeSeries } from "@/components/charts/metric-time-series";
import type { MetricKey } from "@/lib/dashboard/metrics";

/** Catch and revenue pages: time series and seasonality for the header metric, plus the gear treemap. */
export function MetricAnalysis({ metricAtom, gear }: { metricAtom: Atom<MetricKey>; gear: "cpue" | "rpue" }) {
  const metric = useAtomValue(metricAtom);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <MetricTimeSeries metric={metric} className="lg:col-span-8" />
        <MetricRadar metric={metric} className="lg:col-span-4" />
      </div>
      <GearTreemap metric={gear} />
    </>
  );
}
