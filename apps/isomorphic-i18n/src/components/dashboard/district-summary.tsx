import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { useT } from "@/i18n/use-lang";
import { DistrictSummaryBar } from "@/components/dashboard/district-summary-bar";
import { GridMap } from "@/components/dashboard/grid-map";
import { MetricSelect } from "@/components/filters/metric-select";
import { METRIC_KEYS } from "@/lib/dashboard/metrics";
import { selectedMetricAtom } from "@/store/filters";

/** Effort grid map with the ranked district bars beside it; hovering one highlights the other. */
export function DistrictSummary() {
  const { t } = useT();

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("text-district-summary")}</CardTitle>
        <CardAction>
          <MetricSelect
            metricAtom={selectedMetricAtom}
            options={METRIC_KEYS}
            fallback="mean_cpue"
            controlSource="district_widget"
          />
        </CardAction>
      </CardHeader>
      {/* The map keeps a fixed, viewport-based height; the ranking stretches beside it. */}
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <GridMap className="h-[65svh] min-h-96 lg:col-span-8 xl:col-span-9" />
        <DistrictSummaryBar className="lg:col-span-4 xl:col-span-3" />
      </CardContent>
    </Card>
  );
}
