import { CartesianGrid, Line, LineChart, XAxis, YAxis, type XAxisTickContentProps } from "recharts";
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
import { CoverageBadge } from "@/components/dashboard/headline";
import { formatTick, monthAxis, monthLabel, monthTooltipLabel } from "@/lib/dashboard/format";
import {
  estimateInfo,
  formatValue,
  isEstimatedTotal,
  METHOD_COLOR,
  metricTitle,
  metricUnit,
  partialCoverage,
} from "@/lib/dashboard/metrics";
import { selectionLabel } from "@/lib/dashboard/regions";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

type SeriesKey = "value" | "previous" | Method;
type Point = { month: string; districts?: number } & Partial<Record<SeriesKey, number | null>>;
type Series = { key: SeriesKey; label: string; color: string };

/** The tooltip and legend order: the selection (or the tracker method) first. */
const ORDER: SeriesKey[] = ["value", "tracker", "artfish", "previous"];
const byOrder = (item: { dataKey?: unknown }) => ORDER.indexOf(item.dataKey as SeriesKey);

/** A month tick with, under it, how many of the selected districts that month's point adds up. */
function CoverageTick({
  x,
  y,
  textAnchor,
  payload,
  lang,
  counts,
  total,
}: Pick<XAxisTickContentProps, "x" | "y" | "textAnchor" | "payload"> & {
  lang: string;
  counts: Map<string, number | undefined>;
  total: number;
}) {
  const month = String(payload.value);
  return (
    <text x={x} y={y} textAnchor={textAnchor} className="fill-muted-foreground tabular-nums">
      <tspan x={x} dy="0.71em">
        {monthLabel(month, lang)}
      </tspan>
      <tspan x={x} dy="1.3em">
        {counts.get(month) ?? 0}/{total}
      </tspan>
    </text>
  );
}

/**
 * The district selection as one line, month by month (districts weighted by
 * their landings), with the same months a year earlier in grey behind it. An
 * estimate both methods make draws one line per method instead, over the
 * shared district-months, with no year earlier: estimates show no change.
 * A total of estimates adds up only the districts with one that month, so
 * where that is not the whole selection the card says so: its subtitle gives
 * how many districts a month counts on average, each month carries its count,
 * as do the tooltip and the CSV, and under the chart sit the share the total
 * covers (the tiles' badge, moved here) and a note that reads a count out.
 */
export function MetricTrend({ metric }: { metric: MetricKey }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.monthly.useQuery({ ...scope.input, metric }, scope.options);
  // The tiles' own query, so the share under the chart is the one their figure rests on.
  const headline = api.summaries.headline.useQuery(scope.input, scope.options).data;
  const coverage = headline ? partialCoverage(headline, [metric]) : null;
  const keys = methodKeys(metric);
  const methods = query.data?.methods;
  const { shared = 0, unshared = 0 } = query.data ?? {};
  // Every method's line runs over the same months as the metric's own.
  const values: Point[] = (query.data?.overall ?? []).map((p, i) =>
    methods
      ? {
          month: p.month,
          ...Object.fromEntries(METHODS.map((m) => [m, methods[m].overall[i].value])),
        }
      : { month: p.month, value: p.value, previous: p.previous },
  );
  const has = (key: SeriesKey) => values.some((p) => p[key] != null);
  const selection = selectionLabel(t, scope.input.districts);
  const total = scope.input.districts.length;
  // The districts behind each month's point: one count where the lines add up the same ones.
  const drawn = METHODS.filter(has);
  const counted =
    !isEstimatedTotal(metric) || total < 2
      ? null
      : !methods
        ? query.data?.overall
        : drawn.length === 1
          ? methods[drawn[0]].overall
          : shared
            ? methods.tracker.overall
            : null;
  const points: Point[] = counted
    ? values.map((p, i) => ({ ...p, districts: counted[i].districts }))
    : values;
  const inTotal = points.flatMap((p) => (p.districts ? [p.districts] : []));
  const [least, most] = [Math.min(...inTotal), Math.max(...inTotal)];
  // Some month's point leaves districts of the selection out.
  const partial = inTotal.length > 0 && least < total;
  const counts = new Map(points.map((p) => [p.month, p.districts]));
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
    total > 1 &&
    t(METRICS[metric].overDistricts === "sum" ? "text-combined-sum" : "text-combined-mean");
  // A total that leaves districts out names how many a month counts, on average over the months with a point.
  const average = Math.min(
    Math.round(inTotal.reduce((sum, n) => sum + n, 0) / inTotal.length),
    total - 1,
  );
  const subject = partial ? t("text-districts-average", { average, total }) : selection;
  const description = [combined ? `${subject}, ${combined}` : subject, unit]
    .filter(Boolean)
    .join(" · ");
  // The lines of an estimate both methods make, and how they are compared.
  const compared = keys && series.length === 2;

  return (
    <ChartCard
      id={`trend-${metric}`}
      title={t("title-time-series", { metric: metricTitle(t, metric) })}
      description={description}
      info={estimateInfo(t, metric)}
      download={points}
      footer={
        (coverage || partial || compared) && (
          <>
            {coverage && (
              <div>
                <CoverageBadge coverage={coverage} single={total === 1} />
              </div>
            )}
            {/* What each month counts, and with two methods why: one note, not two that overlap. */}
            {partial && (
              <p>
                {t(compared && shared > 0 ? "text-coverage-counts-both" : "text-coverage-counts", {
                  most,
                  total,
                })}
              </p>
            )}
            {compared && shared > 0 && !partial && <p>{t("text-methods-shared")}</p>}
            {compared && shared > 0 && unshared > 0 && (
              <p>{t("text-methods-left-out", { count: unshared })}</p>
            )}
            {compared && !shared && <p>{t("text-methods-none-shared")}</p>}
          </>
        )
      }
    >
      <ChartGate query={query} isEmpty={!series.some((s) => s.key !== "previous" && has(s.key))}>
        <ChartContainer
          config={Object.fromEntries(series.map((s) => [s.key, { label: s.label }]))}
          className={`aspect-auto w-full ${CHART_HEIGHT}`}
        >
          <LineChart accessibilityLayer data={points} margin={{ top: 8, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              {...monthAxis(lang)}
              interval="preserveStartEnd"
              // Two lines where each month says how many districts it adds up.
              {...(partial && {
                height: 44,
                tick: (props: XAxisTickContentProps) => (
                  <CoverageTick {...props} lang={lang} counts={counts} total={total} />
                ),
              })}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width="auto"
              niceTicks="snap125"
              // "dataMax", not "auto": the keyword lets recharts stretch the domain to fill
              // its tick count, which leaves the data in the lower half of the axis.
              domain={[0, "dataMax"]}
              tickFormatter={(v: number) => formatTick(v, lang)}
            />
            <ChartTooltip
              // Recharts sorts tooltip rows only in its own tooltip, so the rows are sorted here.
              content={({ active, label: month, payload }) => (
                <ChartTooltipContent
                  active={active}
                  label={month}
                  payload={payload && [...payload].sort((a, b) => byOrder(a) - byOrder(b))}
                  labelFormatter={(hovered, items) => {
                    const month = monthTooltipLabel(lang)(hovered, items);
                    const districts = counts.get(String(items?.[0]?.payload?.month));
                    return partial && districts != null
                      ? `${month} · ${t("text-scope-districts", { count: districts, total })}`
                      : month;
                  }}
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
