import { DistrictMetricsTable } from "@/components/dashboard/district-metrics-table";
import { DistrictSummary } from "@/components/dashboard/district-summary";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { metaObject } from "@/config/site.config";

export const metadata = metaObject();

export default function HomePage() {
  return (
    <>
      <MetricCards />
      <DistrictSummary />
      <DistrictMetricsTable />
    </>
  );
}
