import { SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { useT } from "@/i18n/use-lang";
import { DistrictFilter } from "@/components/filters/district-filter";
import { MetricSelect } from "@/components/filters/metric-select";
import { TimeRangeSelect } from "@/components/filters/time-range-select";
import { useCurrentPage } from "@/config/routes";

/** Filters for the current page. Metric and districts fold into a popover below `lg`. */
export function HeaderFilters() {
  const { t } = useT();
  const page = useCurrentPage();
  if (!page?.timeRange) return null;

  const { metric, districts: hasDistricts } = page;
  const metricSelect = metric && (
    <MetricSelect metricAtom={metric.atom} options={metric.options} controlSource="header" />
  );

  return (
    <div className="flex items-center gap-2">
      <TimeRangeSelect />
      <div className="hidden items-center gap-2 lg:flex">
        {metricSelect}
        {hasDistricts && <DistrictFilter />}
      </div>
      {(metric || hasDistricts) && (
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
              {metricSelect}
              {hasDistricts && <DistrictFilter />}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
