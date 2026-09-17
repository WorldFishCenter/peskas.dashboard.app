"use client";

import { useAtom } from "jotai";
import PageHeader from "@/app/shared/page-header";
import MetricTimeSeries from "@/app/shared/file/dashboard/charts/metric-time-series";
import MetricRadar from "@/app/shared/file/dashboard/charts/metric-radar";
import RpueGearTreemap from "@/app/shared/file/dashboard/charts/rpue-gear-treemap";
import { selectedRevenueMetricAtom } from "@/app/components/filter-selector";
import { useTranslation } from "@/app/i18n/client";
// ASKFISH INTEGRATION: Reuse the shared panel on Revenue.
// Why: when restriction is ON, AskFish must inherit Revenue page semantics and filters.
import AskFishPanel from "@/app/components/askfish-panel";

export default function RevenuePage() {
  const [selectedMetric] = useAtom(selectedRevenueMetricAtom);
  const { t } = useTranslation("common");

  const pageHeader = {
    title: t("text-revenue-analysis") || "Revenue Analysis",
    breadcrumb: [
      {
        href: "/",
        name: t("text-home") || "Home",
      },
      {
        name: t("nav-revenue") || "Revenue",
      },
    ],
  };

  return (
    <>
      <PageHeader
        title={pageHeader.title}
        breadcrumb={pageHeader.breadcrumb}
      />
      
      {/* ASKFISH INTEGRATION: Explicit page identity keeps restricted queries inside the Revenue catalog scope. */}
      <AskFishPanel pageId="revenue" pageTitle={pageHeader.title} />

      <div className="space-y-4 md:space-y-6">
        {/* Charts Section - responsive layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8">
            <MetricTimeSeries 
              selectedMetrics={[selectedMetric]}
            />
          </div>
          <div className="lg:col-span-4">
            <MetricRadar 
              selectedMetrics={[selectedMetric]}
            />
          </div>
        </div>
        
        {/* RPUE Treemap Section - Full width */}
        <div className="grid grid-cols-1">
          <RpueGearTreemap />
        </div>
      </div>
    </>
  );
}