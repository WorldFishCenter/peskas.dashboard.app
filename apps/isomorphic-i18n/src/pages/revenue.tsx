import { MetricAnalysis } from "@/components/charts/metric-analysis";
import { selectedRevenueMetricAtom } from "@/store/filters";

export default function RevenuePage() {
  return <MetricAnalysis metricAtom={selectedRevenueMetricAtom} gear="mean_rpue" />;
}
