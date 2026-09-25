import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@workspace/ui/components/chart";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { DistrictTooltip } from "@/components/charts/district-tooltip";
import { SeriesLegend } from "@/components/charts/series-legend";
import { formatDashboardNumber } from "@/lib/dashboard/format";
import { metricTitle, type MetricKey } from "@/lib/dashboard/metrics";
import { districtSeries } from "@/lib/dashboard/palettes";
import { districtsAtom } from "@/store/filters";
import { selectedTimeRangeAtom, TIME_RANGE_OPTIONS } from "@/store/time-range";
import { api } from "@/trpc/react";

/** Month-of-year seasonality per selected district. */
export function MetricRadar({ metric, className }: { metric: MetricKey; className?: string }) {
  const { t, lang } = useT();
  const districts = useAtomValue(districtsAtom);
  const range = useAtomValue(selectedTimeRangeAtom);
  const [hidden, setHidden] = useState<string[]>([]);

  const { data, isLoading, error } = api.monthlySummary.radarData.useQuery(
    // "All time" asks for the last year, the widest window the endpoint serves per month.
    { districts, metrics: [metric], months: typeof range === "number" ? range : 12 },
    { enabled: districts.length > 0 }
  );
  const chartData = useMemo(() => (Array.isArray(data) ? (data as Record<string, number | string>[]) : []), [data]);

  const series = useMemo(() => districtSeries(chartData, districts), [chartData, districts]);

  // 10% headroom, rounded up to three "nice" steps so the ring ticks are distinct.
  const domainMax = useMemo(() => {
    const values = chartData.flatMap((p) =>
      Object.entries(p)
        .filter(([k]) => k !== "month")
        .map(([, v]) => Number(v))
        .filter((v) => !isNaN(v))
    );
    const max = values.length ? Math.max(...values) : 0;
    if (max <= 0) return 1;
    const raw = (max * 1.1) / 3;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow * 3;
  }, [chartData]);

  const chartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.key }])) satisfies ChartConfig;
  const visibleKeys = series.map((s) => s.key).filter((k) => !hidden.includes(k));
  const rangeLabelKey =
    TIME_RANGE_OPTIONS.find((o) => o.value === range)?.labelKey ?? "text-last-6-months";

  return (
    <ChartCard
      className={className}
      title={`${metricTitle(t, metric)} ${t("text-seasonality")}`}
      description={t(rangeLabelKey)}
    >
      <ChartGate isLoading={isLoading} error={error} isEmpty={!chartData.length || !series.length}>
        <>
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px] w-full">
            <RadarChart accessibilityLayer data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="month" />
              <PolarRadiusAxis
                angle={90}
                domain={[0, domainMax]}
                tickCount={4}
                tickFormatter={(v) => formatDashboardNumber(v, metric, lang)}
              />
              <ChartTooltip
                itemSorter={(item) => -(Number(item.value) || 0)}
                content={<DistrictTooltip metric={metric} visibleKeys={visibleKeys} />}
              />
              {series.map((s) => (
                <Radar
                  key={s.key}
                  dataKey={s.key}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.3}
                  strokeWidth={2}
                  hide={hidden.includes(s.key)}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              ))}
            </RadarChart>
          </ChartContainer>
          <SeriesLegend series={series} hidden={hidden} onHiddenChange={setHidden} />
        </>
      </ChartGate>
    </ChartCard>
  );
}
