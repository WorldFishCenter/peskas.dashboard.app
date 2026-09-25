import { useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import { cn } from "@workspace/ui/lib/utils";
import { useT } from "@/i18n/use-lang";
import { categoryChartHeight, ChartState } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { formatDashboardNumber, getAggregatedDistrictValue } from "@/lib/dashboard/format";
import { METRIC_KEYS, metricTitle, metricUnit, SUM_METRICS } from "@/lib/dashboard/metrics";
import { getDistrictColor } from "@/lib/dashboard/palettes";
import { hoveredDistrictAtom } from "@/store/dashboard";
import { selectedMetricAtom } from "@/store/filters";
import { dateRangeAtom } from "@/store/time-range";
import { api } from "@/trpc/react";

type DistrictRow = { gaul_2_name: string } & Record<string, unknown>;

export function DistrictSummaryBar({ className }: { className?: string }) {
  const { t, lang } = useT();
  const { start, end } = useAtomValue(dateRangeAtom);
  const metric = useAtomValue(selectedMetricAtom);
  const [hoveredDistrict, setHoveredDistrict] = useAtom(hoveredDistrictAtom);
  const { data, isLoading, error } = api.districtSummary.getDistrictsSummaryByDateRange.useQuery({
    startDate: start,
    endDate: end,
  });

  const chartData = useMemo(
    () =>
      ((data ?? []) as DistrictRow[])
        .map((row) => ({ ...row, name: row.gaul_2_name, value: getAggregatedDistrictValue(row, metric) }))
        .filter((d): d is typeof d & { value: number } => d.value !== null)
        .sort((a, b) => b.value - a.value),
    [data, metric]
  );
  const rankByName = useMemo(() => new Map(chartData.map((d, i) => [d.name, i + 1])), [chartData]);

  if (isLoading) return <ChartState status="loading" className={className} />;
  if (error) return <ChartState status="error" className={className} />;
  if (!chartData.length) {
    return <ChartState status="empty" className={className} description={t("text-no-data-available-for-districts")} />;
  }

  const format = (value: unknown, key: string = metric) => formatDashboardNumber(value, key, lang);
  const unit = metricUnit(t, metric);
  const caption = `${metricTitle(t, metric)}${unit ? ` (${unit})` : ""} (${
    SUM_METRICS.has(metric) ? t("text-aggregated") : t("text-average")
  })`;
  const chartConfig = { value: { label: metricTitle(t, metric) } } satisfies ChartConfig;

  return (
    // The caption replaces an axis title, which would clip in the narrow column beside the map.
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs text-muted-foreground">{caption}</p>
      <ChartContainer
        config={chartConfig}
        // At least one row per district; stretches to the map's height beside it.
        className="aspect-auto w-full flex-1"
        style={{ minHeight: categoryChartHeight(chartData.length, 24) }}
      >
        <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ right: 48 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => format(v)} />
          <YAxis
            dataKey="name"
            type="category"
            width={130}
            tickLine={false}
            axisLine={false}
            tickFormatter={(name: string) => `${rankByName.get(name)}. ${name}`}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideIndicator
                formatter={(_value, _name, item) => {
                  const row = item.payload as DistrictRow;
                  return (
                    <div className="grid w-full gap-1.5">
                      {METRIC_KEYS.map((key) => {
                        const keyUnit = metricUnit(t, key);
                        return (
                          <TooltipRow
                            key={key}
                            label={metricTitle(t, key)}
                            value={`${format(row[key], key)}${keyUnit ? ` ${keyUnit}` : ""}`}
                            className={cn(key === metric && "font-semibold text-foreground")}
                          />
                        );
                      })}
                    </div>
                  );
                }}
              />
            }
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {chartData.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={getDistrictColor(entry.name, index)}
                fillOpacity={hoveredDistrict && hoveredDistrict !== entry.name ? 0.3 : 1}
                onMouseEnter={() => setHoveredDistrict(entry.name)}
                onMouseLeave={() => setHoveredDistrict(null)}
                className="cursor-pointer transition-[fill-opacity] duration-200"
              />
            ))}
            <LabelList dataKey="value" position="right" formatter={(v) => format(v)} className="fill-foreground" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
