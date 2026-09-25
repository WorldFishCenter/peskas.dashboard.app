import { MetricAnalysis } from "@/components/charts/metric-analysis";
import { pages } from "@/config/routes";

export default function CatchPage() {
  return <MetricAnalysis metric={pages.catch.metric} />;
}
