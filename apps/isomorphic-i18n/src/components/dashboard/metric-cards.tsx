import { useAtomValue } from "jotai";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { Line, LineChart, YAxis } from "recharts";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, type ChartConfig } from "@workspace/ui/components/chart";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useT } from "@/i18n/use-lang";
import { InfoPopover } from "@/components/charts/chart-card";
import { ChartState } from "@/components/charts/chart-state";
import type { RouterOutputs } from "@isomorphic/api";
import { confidenceBand, METRICS, type Confidence, type MetricKey } from "@repo/domain/metrics";
import { formatDashboardNumber, monthLabel } from "@/lib/dashboard/format";
import { metricInfo, metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { REGION_COLORS, REGIONS } from "@/lib/dashboard/regions";
import { monthsAtom } from "@/store/time-range";
import { api } from "@/trpc/react";

/** The headline figures, in reading order: how much, how much fishing, what a trip brings. */
const HEADLINE_METRICS: MetricKey[] = [
  "estimated_catch_tn",
  "estimated_revenue",
  "estimated_fishing_trips",
  "mean_catch_kg",
  "mean_catch_price",
  "mean_cpue",
];

type Headline = NonNullable<RouterOutputs["summaries"]["headline"]>;

const sparkConfig = { value: { label: "value" } } satisfies ChartConfig;

/** Change on the same months a year earlier, without judging it: a rise is not always good news. */
function Change({ value, previous }: { value: number | null; previous: number | null }) {
  const { t, lang } = useT();
  if (value == null || previous == null || previous === 0) {
    return <span className="text-xs text-muted-foreground">{t("text-no-comparison")}</span>;
  }
  const pct = ((value - previous) / Math.abs(previous)) * 100;
  const Icon = Math.abs(pct) < 1 ? MinusIcon : pct > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <Badge variant="outline" className="tabular-nums">
      <Icon data-icon="inline-start" />
      {`${pct > 0 ? "+" : ""}${pct.toLocaleString(lang, { maximumFractionDigits: 0 })}%`}
    </Badge>
  );
}

function HeadlineCard({
  metric,
  data,
  confidence,
}: {
  metric: MetricKey;
  data: Headline["metrics"][MetricKey];
  confidence: Confidence | null;
}) {
  const { t, lang } = useT();
  const unit = metricUnit(t, metric);
  const title = metricTitle(t, metric);
  const format = (v: unknown) => formatDashboardNumber(v, metric, lang);
  const points = data.series.filter((p) => p.value != null);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant="secondary">{t(METRICS[metric].estimated ? "text-estimated" : "text-recorded")}</Badge>
        </CardTitle>
        <CardDescription>
          {unit || "\u00a0"}
          {METRICS[metric].estimated && confidence && (
            <span className={confidence === "low" ? "font-medium text-amber-700 dark:text-amber-400" : undefined}>
              {` · ${t("text-confidence")}: ${t(`text-confidence-${confidence}`)}`}
            </span>
          )}
        </CardDescription>
        <CardAction>
          <InfoPopover id={`headline-${metric}`} title={title} info={metricInfo(t, metric)} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <span className="text-3xl font-semibold tabular-nums">{format(data.value)}</span>
          <Change value={data.value} previous={data.previous} />
        </div>
        {points.length > 1 && (
          <ChartContainer config={sparkConfig} className="aspect-auto h-10 w-full">
            <LineChart data={points} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {REGIONS.map((region) => (
            <span key={region} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: REGION_COLORS[region] }} />
              {region}:
              <span className="font-medium tabular-nums">{format(data.regions[region])}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The country's headline figures over the complete months of the header's
 * time range, each against the same months a year earlier.
 */
export function MetricCards() {
  const { t, lang } = useT();
  const months = useAtomValue(monthsAtom);
  const { data, isLoading, error } = api.summaries.headline.useQuery({ months });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {HEADLINE_METRICS.map((m) => (
          <Skeleton key={m} className="h-44" />
        ))}
      </div>
    );
  }
  if (error || !data) return <ChartState status={error ? "error" : "empty"} className="h-40" />;

  // A measure this database doesn't carry (older coasts output) gets no card rather than a "-".
  const shown = HEADLINE_METRICS.filter((m) => data.metrics[m].value != null || data.metrics[m].previous != null);
  const span = (w: { start: string; end: string }) => `${monthLabel(w.start, lang, "long")} – ${monthLabel(w.end, lang, "long")}`;
  const landings = formatDashboardNumber(data.metrics.n_submissions.value, "n_submissions", lang);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm">
        {data.previous
          ? t("text-headline-window", { window: span(data.window), previous: span(data.previous), landings })
          : t("text-headline-window-all", { window: span(data.window), landings })}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((m) => (
          <HeadlineCard key={m} metric={m} data={data.metrics[m]} confidence={confidenceBand(data.samplingRate)} />
        ))}
      </div>
    </section>
  );
}
