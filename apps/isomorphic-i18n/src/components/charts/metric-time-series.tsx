import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@workspace/ui/components/chart";
import { cn } from "@workspace/ui/lib/utils";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { DistrictTooltip } from "@/components/charts/district-tooltip";
import { useSeriesToggle } from "@/components/charts/series-legend";
import { formatDashboardNumber, monthLabel } from "@/lib/dashboard/format";
import type { MetricKey } from "@repo/domain/metrics";
import { metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { districtSeries } from "@/lib/dashboard/palettes";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

/** Monthly series per selected district for the page's metric. */
export function MetricTimeSeries({ metric, className }: { metric: MetricKey; className?: string }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const { districts } = scope.input;

  const query = api.summaries.monthly.useQuery({ ...scope.input, metric }, scope.options);
  const { data } = query;
  const chartData = useMemo(() => data ?? [], [data]);

  // Every selected district with data anywhere in the window, in selection order.
  const series = useMemo(() => districtSeries(chartData, districts), [chartData, districts]);

  const { chartConfig, visibleKeys, isHidden, legend } = useSeriesToggle(series);
  const unit = metricUnit(t, metric);

  return (
    <ChartCard
      className={className}
      title={`${metricTitle(t, metric)} ${t("text-time-series")}`}
      description={unit || undefined}
    >
      <ChartGate query={query} isEmpty={!chartData.length || !series.length}>
        <>
          <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", CHART_HEIGHT)}>
            <LineChart accessibilityLayer data={chartData} margin={{ right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={30}
                tickFormatter={(v) => monthLabel(v, lang)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={40}
                domain={[0, (dataMax: number) => +(dataMax * 1.1).toFixed(2)]}
                tickFormatter={(v) => formatDashboardNumber(v, metric, lang)}
              />
              <ChartTooltip
                itemSorter={(item) => -(Number(item.value) || 0)}
                content={
                  <DistrictTooltip
                    metric={metric}
                    visibleKeys={visibleKeys}
                    labelFormatter={(_, payload) => monthLabel(String(payload?.[0]?.payload?.month), lang, "long")}
                  />
                }
              />
              {series.map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  type="linear"
                  stroke={s.color}
                  strokeWidth={3}
                  dot={{ r: 4, fill: s.color, stroke: s.color }}
                  activeDot={{ r: 6 }}
                  hide={isHidden(s.key)}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          </ChartContainer>
          {legend}
        </>
      </ChartGate>
    </ChartCard>
  );
}
