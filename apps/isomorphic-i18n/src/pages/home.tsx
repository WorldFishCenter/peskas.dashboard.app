import { DistrictMetricsTable } from "@/components/dashboard/district-metrics-table";
import { DistrictSummary } from "@/components/dashboard/district-summary";
import { MetricCards } from "@/components/dashboard/metric-cards";

export default function HomePage() {
  return (
    <>
      <MetricCards />
      <DistrictSummary />
      <DistrictMetricsTable />
    </>
  );
}
