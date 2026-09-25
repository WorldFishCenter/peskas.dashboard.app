import { SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { useAppRoute, useT } from "@/i18n/use-lang";
import { DistrictFilter } from "@/components/filters/district-filter";
import { MetricSelect } from "@/components/filters/metric-select";
import { TimeRangeSelect } from "@/components/filters/time-range-select";
import { routes } from "@/config/routes";
import { CATCH_PAGE_METRICS, REVENUE_PAGE_METRICS } from "@/lib/dashboard/metrics";
import { selectedMetricAtom, selectedRevenueMetricAtom } from "@/store/filters";

const DATA_ROUTES = [routes.home, routes.catch, routes.revenue, routes.catchComposition];
const DISTRICT_ROUTES = [routes.catch, routes.revenue, routes.catchComposition];

function PageMetricSelect({ route }: { route: string }) {
  if (route === routes.catch) {
    return (
      <MetricSelect
        metricAtom={selectedMetricAtom}
        options={CATCH_PAGE_METRICS}
        fallback="mean_cpue"
        controlSource="header"
      />
    );
  }
  if (route === routes.revenue) {
    return (
      <MetricSelect
        metricAtom={selectedRevenueMetricAtom}
        options={REVENUE_PAGE_METRICS}
        fallback="estimated_revenue"
        controlSource="header"
      />
    );
  }
  return null;
}

/** Filters for the current page. Metric and districts fold into a popover below `lg`. */
export function HeaderFilters() {
  const { t } = useT();
  const route = useAppRoute();

  if (!DATA_ROUTES.includes(route)) return null;

  const hasMetric = route === routes.catch || route === routes.revenue;
  const hasDistricts = DISTRICT_ROUTES.includes(route);

  return (
    <div className="flex items-center gap-2">
      <TimeRangeSelect />
      <div className="hidden items-center gap-2 lg:flex">
        <PageMetricSelect route={route} />
        {hasDistricts && <DistrictFilter />}
      </div>
      {(hasMetric || hasDistricts) && (
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" className="lg:hidden" />}>
            <SlidersHorizontalIcon data-icon="inline-start" />
            {t("text-filters")}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto">
            <PopoverHeader>
              <PopoverTitle>{t("text-additional-filters")}</PopoverTitle>
            </PopoverHeader>
            <div className="flex flex-col items-start gap-2">
              <PageMetricSelect route={route} />
              {hasDistricts && <DistrictFilter />}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
