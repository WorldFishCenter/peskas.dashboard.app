"use client";

import { useAtom } from "jotai";
import PageHeader from "@/app/shared/page-header";
import MetricTimeSeries from "@/app/shared/file/dashboard/charts/metric-time-series";
import MetricRadar from "@/app/shared/file/dashboard/charts/metric-radar";
import CpueGearTreemap from "@/app/shared/file/dashboard/charts/cpue-gear-treemap";
import { selectedMetricAtom } from "@/app/components/filter-selector";
import { useTranslation } from "@/app/i18n/client";
// ASKFISH INTEGRATION: Mount the shared AskFish side panel on Catch.
// Why: send page/filter context to AskFish without coupling AskFish to rendered chart data.
import AskFishPanel from "@/app/components/askfish-panel";

export default function CatchPage() {
  const [selectedMetric] = useAtom(selectedMetricAtom);
  const { t } = useTranslation("common");

  const pageHeader = {
    title: t("text-catch-analysis") || "Catch Analysis",
    breadcrumb: [
      {
        href: "/",
        name: t("text-home") || "Home",
      },
      {
        name: t("nav-catch") || "Catch",
      },
    ],
  };

  return (
    <>
      <PageHeader
        title={pageHeader.title}
        breadcrumb={pageHeader.breadcrumb}
      />
      
      {/* ASKFISH INTEGRATION: Catch is the default catch_trends context; the panel reads the same Jotai filters used by this page. */}
      <AskFishPanel />

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
        
        {/* CPUE Treemap Section - Full width */}
        <div className="grid grid-cols-1">
          <CpueGearTreemap />
        </div>
      </div>
    </>
  );
}