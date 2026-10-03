import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { methodKeys, METHODS, METRICS, type Method, type MetricKey } from "@repo/domain/metrics";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { formatTick, monthAxis, monthTooltipLabel } from "@/lib/dashboard/format";
import {
  estimateInfo,
  formatValue,
  METHOD_COLOR,
  metricTitle,
  metricUnit,
} from "@/lib/dashboard/metrics";
import { selectionLabel } from "@/lib/dashboard/regions";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

type SeriesKey = "value" | "previous" | Method;
type Point = { month: string } & Partial<Record<SeriesKey, number | null>>;
type Series = { key: SeriesKey; label: string; color: string };

/** The tooltip and legend order: the selection (or the tracker method) first. */
const ORDER: SeriesKey[] = ["value", "tracker", "artfish", "previous"];
const byOrder = (item: { dataKey?: unknown }) => ORDER.indexOf(item.dataKey as SeriesKey);

/**
 * The district selection as one line, month by month (districts weighted by
 * their landings), with the same months a year earlier in grey behind it. An
 * estimate both methods make draws one line per method instead, over the
 * shared district-months, with no year earlier: estimates show no change.
 */
export function MetricTrend({ metric }: { metric: MetricKey }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.monthly.useQuery({ ...scope.input, metric }, scope.options);
  const keys = methodKeys(metric);
  const methods = query.data?.methods;
  // Every method's line runs over the same months as the metric's own.
  const points: Point[] = (query.data?.overall ?? []).map((p, i) =>
    methods
      ? {
          month: p.month,
          ...Object.fromEntries(METHODS.map((m) => [m, methods[m].overall[i].value])),
        }
      : p,
  );
  const has = (key: SeriesKey) => points.some((p) => p[key] != null);
  const selection = selectionLabel(t, scope.input.districts);
  // Drawn in this order: the year earlier behind the selection.
  const series: Series[] = keys
    ? METHODS.filter(has).map((m) => ({
        key: m,
        label: t(`text-method-${m}`),
        color: METHOD_COLOR[m],
      }))
    : [
        ...(has("previous")
          ? [
              {
                key: "previous" as const,
                label: t("text-same-month-year-earlier"),
                color: "var(--context)",
              },
            ]
          : []),
        { key: "value", label: selection, color: "var(--chart-1)" },
      ];
  const label = Object.fromEntries(series.map((s) => [s.key, s.label]));
  const format = (key: unknown, v: unknown) =>
    formatValue(keys?.[key as Method] ?? metric, typeof v === "number" ? v : null, lang);
  const unit = metricUnit(t, metric);
  // How the districts make the one line: said once there is more than one.
  const combined =
    scope.input.districts.length > 1 &&
    t(METRICS[metric].overDistricts === "sum" ? "text-combined-sum" : "text-combined-mean");
  const { shared = 0, unshared = 0 } = query.data ?? {};

  return (
    <ChartCard
      id={`trend-${metric}`}
      title={t("title-time-series", { metric: metricTitle(t, metric) })}
      description={[combined ? `${selection}, ${combined}` : selection, unit]
        .filter(Boolean)
        .join(" · ")}
      info={estimateInfo(t, metric)}
      download={points}
      footer={
        keys &&
        series.length === 2 &&
        (shared ? (
          <>
            <p>{t("text-methods-shared")}</p>
            {unshared > 0 && <p>{t("text-methods-left-out", { count: unshared })}</p>}
          </>
        ) : (
          <p>{t("text-methods-none-shared")}</p>
        ))
      }
    >
      <ChartGate query={query} isEmpty={!series.some((s) => s.key !== "previous" && has(s.key))}>
        <ChartContainer
          config={Object.fromEntries(series.map((s) => [s.key, { label: s.label }]))}
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
              content={({ active, label: month, payload }) => (
                <ChartTooltipContent
                  active={active}
                  label={month}
                  payload={payload && [...payload].sort((a, b) => byOrder(a) - byOrder(b))}
                  labelFormatter={monthTooltipLabel(lang)}
                  formatter={(value, name, item) => (
                    <TooltipRow
                      color={item.color}
                      label={label[String(name)]}
                      value={format(name, value)}
                    />
                  )}
                />
              )}
            />
            <ChartLegend content={<ChartLegendContent />} itemSorter={byOrder} />
            {series.map((s) =>
              s.key === "previous" ? (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={points.length <= 18 ? { r: 3, fill: s.color } : false}
                  activeDot={{ r: 5 }}
                />
              ),
            )}
          </LineChart>
        </ChartContainer>
      </ChartGate>
    </ChartCard>
  );
}
