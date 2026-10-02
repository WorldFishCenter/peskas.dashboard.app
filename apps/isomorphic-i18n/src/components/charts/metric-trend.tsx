import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { METRICS, type MetricKey } from "@repo/domain/metrics";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { formatNumber, formatTick, monthAxis, monthTooltipLabel } from "@/lib/dashboard/format";
import { metricInfo, metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { selectionLabel } from "@/lib/dashboard/regions";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

type Point = { month: string; value: number | null; previous: number | null };

/** The selection before the year earlier, in the legend and the tooltip alike. */
const valueFirst = (item: { dataKey?: unknown }) => (item.dataKey === "value" ? 0 : 1);

/**
 * The district selection as one line, month by month (districts weighted by
 * their landings), with the same months a year earlier in grey behind it.
 */
export function MetricTrend({ metric }: { metric: MetricKey }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.monthly.useQuery({ ...scope.input, metric }, scope.options);
  const points: Point[] = query.data?.overall ?? [];
  const hasPrevious = points.some((p) => p.previous != null);
  const unit = metricUnit(t, metric);
  const format = (v: unknown) => formatNumber(v, lang);
  const selection = selectionLabel(t, scope.input.districts);
  // How the districts make the one line: said once there is more than one.
  const combined =
    scope.input.districts.length > 1 &&
    t(METRICS[metric].overDistricts === "sum" ? "text-combined-sum" : "text-combined-mean");

  return (
    <ChartCard
      id={`trend-${metric}`}
      title={t("title-time-series", { metric: metricTitle(t, metric) })}
      description={[combined ? `${selection}, ${combined}` : selection, unit]
        .filter(Boolean)
        .join(" · ")}
      info={metricInfo(t, metric)}
      download={points}
    >
      <ChartGate query={query} isEmpty={!points.some((p) => p.value != null)}>
        <ChartContainer
          config={{
            value: { label: selection },
            previous: { label: t("text-same-month-year-earlier") },
          }}
          className={`aspect-auto w-full ${CHART_HEIGHT}`}
        >
          <LineChart accessibilityLayer data={points} margin={{ top: 8, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis {...monthAxis(lang)} interval="preserveStartEnd" />
            <YAxis
              tickLine={false}
              axisLine={false}
              width="auto"
              niceTicks="snap125"
              domain={[0, "auto"]}
              tickFormatter={(v: number) => formatTick(v, lang)}
            />
            <ChartTooltip
              // Recharts sorts tooltip rows only in its own tooltip, so the rows are sorted here.
              content={({ active, label, payload }) => (
                <ChartTooltipContent
                  active={active}
                  label={label}
                  payload={payload && [...payload].sort((a, b) => valueFirst(a) - valueFirst(b))}
                  labelFormatter={monthTooltipLabel(lang)}
                  formatter={(value, name, item) => (
                    <TooltipRow
                      color={item.color}
                      label={name === "previous" ? t("text-same-month-year-earlier") : selection}
                      value={format(value)}
                    />
                  )}
                />
              )}
            />
            <ChartLegend content={<ChartLegendContent />} itemSorter={valueFirst} />
            {hasPrevious && (
              <Line
                dataKey="previous"
                stroke="var(--context)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              dataKey="value"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={points.length <= 18 ? { r: 3, fill: "var(--chart-1)" } : false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </ChartGate>
    </ChartCard>
  );
}
