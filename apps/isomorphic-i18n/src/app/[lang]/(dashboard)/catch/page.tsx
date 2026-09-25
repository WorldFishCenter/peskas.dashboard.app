"use client";

import { MetricAnalysis } from "@/components/charts/metric-analysis";
import { selectedMetricAtom } from "@/store/filters";

export default function CatchPage() {
  return <MetricAnalysis metricAtom={selectedMetricAtom} gear="cpue" />;
}
