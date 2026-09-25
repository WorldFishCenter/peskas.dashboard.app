import { MetricAnalysis } from "@/components/charts/metric-analysis";
import { pages } from "@/config/routes";

export default function RevenuePage() {
  return <MetricAnalysis metric={pages.revenue.metric} />;
}
