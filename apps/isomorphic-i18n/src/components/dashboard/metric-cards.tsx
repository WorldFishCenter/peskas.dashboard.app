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
import { formatDashboardNumber } from "@/lib/dashboard/format";
import { metricDescription, metricTitle, metricUnit, type MetricKey } from "@/lib/dashboard/metrics";
import { api } from "@/trpc/react";

// n_fishers and mean_price_kg are not in the current data pipeline.
const CARD_METRICS: MetricKey[] = [
  "n_submissions",
  "trip_duration_hrs",
  "mean_cpue",
  "mean_rpue",
  "estimated_catch_tn",
  "estimated_revenue",
];

const chartConfig = Object.fromEntries(REGIONS.map((r) => [r, { label: r }])) satisfies ChartConfig;

type MonthlyRegionData = { data: ({ month: string } & Record<string, number | null>)[]; months?: string[] };

function MetricCard({ metric, data }: { metric: MetricKey; data: MonthlyRegionData }) {
  const { t, lang } = useT();
  const format = (value: unknown) => formatDashboardNumber(value, metric, lang);
  const unit = metricUnit(t, metric);

  const last3 = data.data.slice(-3);
  const months = data.months?.slice(-3) ?? last3.map((d) => d.month);
  const chartData = months.map((month) => {
    const row = last3.find((d) => d.month === month);
    return { month, ...Object.fromEntries(REGIONS.map((r) => [r, row?.[r] ?? null])) };
  });
  const latest = last3[last3.length - 1];

  return (
    <Card size="sm" className="@container/card w-72 shrink-0">
      <CardHeader>
        <CardTitle>
          {metricTitle(t, metric)}
          {unit && ` (${unit})`}
        </CardTitle>
        <CardDescription>{metricDescription(t, metric)}</CardDescription>
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
  const { data, isLoading, error } = api.districtSummary.getMonthlyRegionSummary.useQuery({ months: 3 });

  if (isLoading) {
    return (
      <CardRow>
        {CARD_METRICS.map((m) => (
          <Skeleton key={m} className="h-52 w-72 shrink-0" />
        ))}
      </CardRow>
    );
  }

  const metrics = CARD_METRICS.filter((m) => data?.[m]?.data?.length);
  if (error || !metrics.length) {
    return <ChartState status={error ? "error" : "empty"} className="h-40" />;
  }

  return (
    <CardRow>
      {metrics.map((m) => (
        <MetricCard key={m} metric={m} data={data![m] as MonthlyRegionData} />
      ))}
    </CardRow>
  );
}
