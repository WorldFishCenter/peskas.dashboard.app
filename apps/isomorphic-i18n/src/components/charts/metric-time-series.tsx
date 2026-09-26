import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@workspace/ui/components/chart";
import { cn } from "@workspace/ui/lib/utils";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { DistrictTooltip } from "@/components/charts/district-tooltip";
import { useSeriesToggle } from "@/components/charts/series-legend";
import { formatDashboardNumber, monthAxis, monthTooltipLabel } from "@/lib/dashboard/format";
import type { MetricKey } from "@repo/domain/metrics";
import { metricInfo, metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { districtSeries } from "@/lib/dashboard/palettes";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

type DotProps = { cx?: number; cy?: number; payload?: { month: string } };

/** Monthly series per selected district for the page's metric; months on too few landings are hollow. */
export function MetricTimeSeries({ metric, className }: { metric: MetricKey; className?: string }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const { districts } = scope.input;

  const query = api.summaries.monthly.useQuery({ ...scope.input, metric }, scope.options);
  const chartData = useMemo(() => query.data?.rows ?? [], [query.data]);
  const thin = useMemo(() => new Set(query.data?.thin), [query.data]);

  // Every selected district with data anywhere in the window, in selection order.
  const series = useMemo(() => districtSeries(chartData, districts), [chartData, districts]);

  const { chartConfig, visibleKeys, isHidden, legend } = useSeriesToggle(series);
  const unit = metricUnit(t, metric);
  const anyThin = chartData.some((row) => visibleKeys.some((d) => row[d] != null && thin.has(`${row.month}|${d}`)));

  return (
    <ChartCard
      id={`time-series-${metric}`}
      className={className}
      title={t("title-time-series", { metric: metricTitle(t, metric) })}
      description={unit || undefined}
      info={metricInfo(t, metric)}
      download={chartData}
      scope={scope}
      footer={anyThin && t("text-hollow-points")}
    >
      <ChartGate query={query} isEmpty={!chartData.length || !series.length}>
        <>
          <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", CHART_HEIGHT)}>
            <LineChart accessibilityLayer data={chartData} margin={{ right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis {...monthAxis(lang)} interval="preserveStartEnd" />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                domain={[0, (dataMax: number) => +(dataMax * 1.1).toFixed(2)]}
                tickFormatter={(v) => formatDashboardNumber(v, metric, lang)}
              />
              <ChartTooltip
                itemSorter={(item) => -(Number(item.value) || 0)}
                content={
                  <DistrictTooltip
                    metric={metric}
                    visibleKeys={visibleKeys}
                    labelFormatter={monthTooltipLabel(lang)}
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
                  dot={({ cx, cy, payload }: DotProps) => (
                    <circle
                      key={`${s.key}-${payload?.month}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      stroke={s.color}
                      strokeWidth={2}
                      fill={payload && thin.has(`${payload.month}|${s.key}`) ? "var(--background)" : s.color}
                    />
                  )}
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
