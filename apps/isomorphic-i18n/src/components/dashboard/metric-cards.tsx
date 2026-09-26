import { Bar, BarChart, LabelList, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useT } from "@/i18n/use-lang";
import { ChartState } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { REGION_COLORS, REGIONS } from "@/lib/dashboard/regions";
import { formatDashboardNumber, monthLabel } from "@/lib/dashboard/format";
import type { RouterOutputs } from "@isomorphic/api";
import type { MetricKey } from "@repo/domain/metrics";
import { metricDescription, metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { api } from "@/trpc/react";

const CARD_METRICS: MetricKey[] = [
  "n_submissions",
  "trip_duration_hrs",
  "mean_cpue",
  "mean_rpue",
  "estimated_catch_tn",
  "estimated_revenue",
];

const chartConfig = Object.fromEntries(REGIONS.map((r) => [r, { label: r }])) satisfies ChartConfig;

// A trend strip: always the last 3 months, whatever the header's time range.
const CARD_MONTHS = 3;

type RegionMonth = RouterOutputs["summaries"]["regionTrend"][MetricKey][number];

function MetricCard({ metric, rows }: { metric: MetricKey; rows: RegionMonth[] }) {
  const { t, lang } = useT();
  const format = (value: unknown) => formatDashboardNumber(value, metric, lang);
  const unit = metricUnit(t, metric);

  const chartData = rows.map((row) => ({
    month: monthLabel(row.month, lang),
    ...Object.fromEntries(REGIONS.map((r) => [r, row[r] ?? null])),
  }));
  const latest = rows.at(-1);

  return (
    <Card size="sm" className="@container/card w-72 shrink-0">
      <CardHeader>
        <CardTitle>
          {metricTitle(t, metric)}
          {unit && ` (${unit})`}
        </CardTitle>
        <CardDescription>
          {metricDescription(t, metric)} {t("text-last-3-months")}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {REGIONS.map((region) => (
            <span key={region} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: REGION_COLORS[region] }} />
              {region}:
              <span className="font-medium tabular-nums">{format(latest?.[region])}</span>
            </span>
          ))}
        </div>
        <ChartContainer config={chartConfig} className="aspect-auto h-24 w-full">
          <BarChart accessibilityLayer data={chartData} margin={{ top: 16 }} barCategoryGap={0}>
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => (
                    <TooltipRow color={item.color} label={name} value={format(value)} />
                  )}
                />
              }
            />
            {REGIONS.map((region) => (
              <Bar
                key={region}
                dataKey={region}
                fill={REGION_COLORS[region]}
                radius={[4, 4, 0, 0]}
                barSize={18}
                minPointSize={6}
              >
                <LabelList
                  position="top"
                  formatter={format}
                  fill={REGION_COLORS[region]}
                  className="text-[11px] font-semibold"
                />
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/** One horizontally scrollable row of cards. */
function CardRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollArea className="w-full">
      <div className="flex w-max gap-4 pb-3">{children}</div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

export function MetricCards() {
  const { data, isLoading, error } = api.summaries.regionTrend.useQuery({ months: CARD_MONTHS });

  if (isLoading) {
    return (
      <CardRow>
        {CARD_METRICS.map((m) => (
          <Skeleton key={m} className="h-52 w-72 shrink-0" />
        ))}
      </CardRow>
    );
  }

  const metrics = CARD_METRICS.filter((m) => data?.[m].length);
  if (error || !metrics.length) {
    return <ChartState status={error ? "error" : "empty"} className="h-40" />;
  }

  return (
    <CardRow>
      {metrics.map((m) => (
        <MetricCard key={m} metric={m} rows={data![m]} />
      ))}
    </CardRow>
  );
}
