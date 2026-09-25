"use client";

import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@workspace/ui/components/chart";
import { cn } from "@workspace/ui/lib/utils";
import { useT } from "@/app/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { DistrictTooltip } from "@/components/charts/district-tooltip";
import { SeriesLegend } from "@/components/charts/series-legend";
import { formatDashboardNumber } from "@/lib/dashboard/format";
import { metricTitle, metricUnit, type MetricKey } from "@/lib/dashboard/metrics";
import { districtSeries } from "@/lib/dashboard/palettes";
import { districtsAtom } from "@/store/filters";
import { monthsAtom } from "@/store/time-range";
import { api } from "@/trpc/react";

/** Monthly series per selected district for the page's metric. */
export function MetricTimeSeries({ metric, className }: { metric: MetricKey; className?: string }) {
  const { t, lang } = useT();
  const districts = useAtomValue(districtsAtom);
  const months = useAtomValue(monthsAtom);
  const [hidden, setHidden] = useState<string[]>([]);

  const { data, isLoading, error } = api.monthlySummary.timeSeries.useQuery(
    { districts, metrics: [metric], months },
    { enabled: districts.length > 0 }
  );

  const chartData = useMemo(
    () =>
      Object.keys(data ?? {})
        .sort()
        .map((date) => ({ date, ...data![date][metric] })),
    [data, metric]
  );

  // Every selected district with data anywhere in the window, in selection order.
  const series = useMemo(() => districtSeries(chartData, districts), [chartData, districts]);

  const chartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.key }])) satisfies ChartConfig;
  const visibleKeys = series.map((s) => s.key).filter((k) => !hidden.includes(k));
  const unit = metricUnit(t, metric);
  const monthLabel = (value: string, month: "short" | "long") =>
    new Date(value).toLocaleDateString(lang, { month, year: month === "short" ? "2-digit" : "numeric" });

  return (
    <ChartCard
      className={className}
      title={`${metricTitle(t, metric)} ${t("text-time-series")}`}
      description={unit || undefined}
    >
      <ChartGate isLoading={isLoading} error={error} isEmpty={!chartData.length || !series.length}>
        <>
          <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", CHART_HEIGHT)}>
            <LineChart accessibilityLayer data={chartData} margin={{ right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={30}
                tickFormatter={(v) => monthLabel(v, "short")}
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
                    labelFormatter={(_, payload) => monthLabel(String(payload?.[0]?.payload?.date), "long")}
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
                  hide={hidden.includes(s.key)}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          </ChartContainer>
          <SeriesLegend series={series} hidden={hidden} onHiddenChange={setHidden} />
        </>
      </ChartGate>
    </ChartCard>
  );
}
