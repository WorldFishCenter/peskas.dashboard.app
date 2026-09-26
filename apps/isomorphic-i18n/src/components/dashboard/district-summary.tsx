import { useAtomValue } from "jotai";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { DistrictSummaryBar } from "@/components/dashboard/district-summary-bar";
import { GridMap } from "@/components/dashboard/grid-map";
import { MetricSelect } from "@/components/filters/metric-select";
import { METRIC_KEYS } from "@repo/domain/metrics";
import { homeMetricAtom } from "@/store/filters";
import { monthsAtom } from "@/store/time-range";
import { api } from "@/trpc/react";

/** Effort grid map with the ranked district bars beside it; hovering one highlights the other. */
export function DistrictSummary() {
  const { t } = useT();
  const months = useAtomValue(monthsAtom);
  const { data } = api.summaries.byDistrict.useQuery({ months });

  return (
    <ChartCard
      id="district-map"
      title={t("title-district-summary")}
      description={t("text-district-summary-description")}
      info="info-map"
      download={data}
      scope={{ input: { months } }}
      action={<MetricSelect metricAtom={homeMetricAtom} options={METRIC_KEYS} controlSource="district_widget" />}
    >
      {/* The map keeps a fixed, viewport-based height; the ranking stretches beside it. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <GridMap className="h-[65svh] min-h-96 lg:col-span-8 xl:col-span-9" />
        <DistrictSummaryBar className="lg:col-span-4 xl:col-span-3" />
      </div>
    </ChartCard>
  );
}
