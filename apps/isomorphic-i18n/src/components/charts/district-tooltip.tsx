import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { ChartTooltipContent } from "@workspace/ui/components/chart";
import { useT } from "@/i18n/use-lang";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { formatDashboardNumber } from "@/lib/dashboard/format";

/**
 * Per-district tooltip for the time series and radar charts. Rows arrive
 * sorted by value (via `itemSorter`); the highest and lowest are marked.
 */
export function DistrictTooltip({
  metric,
  visibleKeys,
  ...props
}: React.ComponentProps<typeof ChartTooltipContent> & { metric: string; visibleKeys: string[] }) {
  const { lang } = useT();

  return (
    <ChartTooltipContent
      {...props}
      formatter={(value, name, item) => {
        const row = item.payload as Record<string, unknown>;
        const values = visibleKeys.map((k) => row[k]).filter((v): v is number => typeof v === "number");
        const max = Math.max(...values);
        const min = Math.min(...values);
        const v = Number(value);
        const isHighest = v === max && max > 0;
        const isLowest = !isHighest && v === min && min > 0 && max !== min;
        return (
          <TooltipRow
            color={item.color}
            className={isHighest ? "font-semibold" : undefined}
            label={
              <span className="flex items-center gap-1">
                {name}
                {isHighest && <ArrowUpIcon className="size-3" />}
                {isLowest && <ArrowDownIcon className="size-3" />}
              </span>
            }
            value={formatDashboardNumber(v, metric, lang)}
          />
        );
      }}
    />
  );
}
