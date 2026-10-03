import { useMemo, useState } from "react";
import { Line, LineChart, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@workspace/ui/components/chart";
import { cn } from "@workspace/ui/lib/utils";
import {
  combine,
  FEW_LANDINGS,
  methodKeys,
  METHODS,
  METRICS,
  type Method,
  type MetricKey,
} from "@repo/domain/metrics";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { Legend } from "@/components/charts/legend";
import { WarningIcon } from "@/components/charts/warning-icon";
import { landingsCount, monthLabel, monthSpan } from "@/lib/dashboard/format";
import {
  byFigures,
  formatValue,
  METHOD_COLOR,
  metricTitle,
  metricUnit,
} from "@/lib/dashboard/metrics";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

/** A district's line: `value` and `overall`, or one per method for an estimate both methods make. */
type LineKey = "value" | Method;
type Point = { month: string; thin: boolean } & Partial<Record<LineKey | "overall", number | null>>;
/** The metric behind a line: the metric's own, or a method's key. */
const keyOf = (metric: MetricKey, line: LineKey) =>
  line === "value" ? metric : methodKeys(metric)?.[line] ?? metric;

type DotProps = { cx?: number; cy?: number; value?: unknown; payload?: Point; index?: number };

/**
 * One small chart per selected district, all on the same axis and sorted by
 * the window's value, with the average district in grey behind each: a
 * district is read against the others without eleven crossing lines. For an
 * average metric that is the selection's figure (weighted by landings); for a
 * total, the mean of the districts, since their sum would dwarf every panel.
 *
 * Pointing at a month marks it in every panel (Recharts' `syncId`) with no
 * tooltip over the lines: the figure beside each name turns into that month's
 * value, and one line above the panels names the month and the average. A
 * tooltip in each of up to 19 panels covered the lines it described.
 *
 * An estimate both methods make draws each method's line instead of the
 * average, so a district without tracked boats still shows its ARTFISH line,
 * and shows even for one district when the trend leaves months out.
 */
export function DistrictMultiples({ metric }: { metric: MetricKey }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const keys = methodKeys(metric);
  const monthly = api.summaries.monthly.useQuery({ ...scope.input, metric }, scope.options);
  const districts = api.summaries.byDistrict.useQuery(scope.input, scope.options);

  const total = METRICS[metric].overDistricts === "sum";
  const { panels, max, anyThin, drawn } = useMemo(() => {
    const rows = monthly.data?.rows ?? [];
    const methods = monthly.data?.methods;
    // The lines a panel can draw: the district, or each method.
    const order: LineKey[] = methods ? [...METHODS] : ["value"];
    const selection = new Map((monthly.data?.overall ?? []).map((p) => [p.month, p.value]));
    const reference = new Map(
      rows.map((r) => {
        const values = Object.entries(r).flatMap(([k, v]) => (k === "month" ? [] : [v as number]));
        return [r.month, total ? combine(values, "mean") : selection.get(r.month) ?? null];
      }),
    );
    const thin = new Set(monthly.data?.thin);
    const at = (row: Record<string, unknown> | undefined, district: string) =>
      (row?.[district] as number | undefined) ?? null;
    const panels = (districts.data ?? [])
      .map((d) => ({
        district: d.district,
        // The window's figure of each line: each district's own months, or its shared ones.
        figures: Object.fromEntries(order.map((k) => [k, d[keyOf(metric, k)]])) as Partial<
          Record<LineKey, number | null>
        >,
        landings: d.n_submissions ?? 0,
        // Every method's rows run over the same months as the metric's own.
        points: rows.map(
          (r, i): Point => ({
            month: r.month,
            thin: thin.has(`${r.month}|${d.district}`),
            ...(methods
              ? Object.fromEntries(METHODS.map((m) => [m, at(methods[m].rows[i], d.district)]))
              : { value: at(r, d.district), overall: reference.get(r.month) ?? null }),
          }),
        ),
      }))
      .filter((p) => p.points.some((q) => order.some((k) => q[k] != null)))
      .sort((a, b) =>
        byFigures(
          order.map((k) => a.figures[k]),
          order.map((k) => b.figures[k]),
        ),
      );
    const max = Math.max(
      0,
      ...panels.flatMap((p) =>
        p.points.flatMap((q) => [...order, "overall" as const].map((k) => q[k] ?? 0)),
      ),
    );
    const anyThin = panels.some((p) =>
      p.points.some((q) => q.thin && order.some((k) => q[k] != null)),
    );
    // The lines with something to draw, in the legend and in each panel.
    const drawn = order.filter((k) => panels.some((p) => p.points.some((q) => q[k] != null)));
    return { panels, max, anyThin, drawn };
  }, [monthly.data, districts.data, metric, total]);

  // The month pointed at, as an index into every panel's points (they share the months).
  const [active, setActive] = useState<number | null>(null);

  // One district is already the whole trend above, unless the trend leaves out months only one method estimates.
  if (scope.input.districts.length === 1 && !monthly.data?.unshared) return null;
  const unit = metricUnit(t, metric);
  const format = (key: LineKey, v: number | null | undefined) =>
    formatValue(keyOf(metric, key), v, lang);
  const colorOf = (key: LineKey) => (key === "value" ? "var(--chart-1)" : METHOD_COLOR[key]);
  const months = panels[0]?.points ?? [];
  const hovered = active == null ? undefined : months[active];
  const averageLabel = t(total ? "text-selection-average" : "text-selection-average-weighted");

  return (
    <ChartCard
      id={`districts-${metric}`}
      title={t("title-district-multiples")}
      description={t("text-district-multiples-description", { metric: metricTitle(t, metric) })}
      footer={
        <>
          <Legend
            items={[
              ...(keys
                ? (drawn as Method[]).map((m) => ({
                    label: t(`text-method-${m}`),
                    color: METHOD_COLOR[m],
                    shape: "line" as const,
                  }))
                : [
                    {
                      label: t("text-multiples-district"),
                      color: "var(--chart-1)",
                      shape: "line" as const,
                    },
                    {
                      label: averageLabel,
                      color: "var(--context-muted)",
                      shape: "line" as const,
                    },
                  ]),
              ...(anyThin
                ? [
                    {
                      label: t("text-thin-month", { min: FEW_LANDINGS }),
                      color: "var(--chart-1)",
                      shape: "hollow" as const,
                    },
                  ]
                : []),
            ]}
          />
          <p>
            {t("text-multiples-axis", {
              max: `${formatValue(metric, max, lang)}${unit ? ` ${unit}` : ""}`,
            })}
          </p>
        </>
      }
    >
      <ChartGate query={monthly} isEmpty={!panels.length}>
        {/* What the figures beside the names are: the selected months, or the month pointed at. */}
        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {hovered ? (
            <>
              <span className="font-medium text-foreground">
                {monthLabel(hovered.month, lang, "long")}
              </span>
              {!keys && (
                <>
                  {` · ${averageLabel}: `}
                  <span className="font-medium text-foreground tabular-nums">
                    {format("value", hovered.overall)}
                  </span>
                </>
              )}
            </>
          ) : (
            months.length > 0 &&
            `${monthSpan(months[0].month, months.at(-1)!.month, lang)} · ${t("text-multiples-point")}`
          )}
        </p>
        <div
          className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          onMouseLeave={() => setActive(null)}
        >
          {panels.map((p) => {
            const thin = p.landings < FEW_LANDINGS;
            const point = active == null ? undefined : p.points[active];
            const figure = cn(
              "tabular-nums",
              point && "font-semibold",
              point?.thin && "font-normal text-muted-foreground",
            );
            return (
              <div key={p.district} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium" title={p.district}>
                    {p.district}
                  </span>
                  {!keys && (
                    <span className={figure}>
                      {format("value", point ? point.value : p.figures.value)}
                    </span>
                  )}
                </div>
                {keys && (
                  // Each method's figure, keyed by its line: the window's, or the month's pointed at.
                  <Legend
                    className={cn("text-[13px] text-foreground", figure)}
                    items={drawn.map((k) => ({
                      label: format(k, point ? point[k] : p.figures[k]),
                      color: colorOf(k),
                      shape: "line",
                    }))}
                  />
                )}
                <ChartContainer
                  config={{
                    value: { label: p.district },
                    tracker: { label: t("text-method-tracker") },
                    artfish: { label: t("text-method-artfish") },
                    overall: { label: t("text-selection-average") },
                  }}
                  className="aspect-auto h-20 w-full"
                >
                  <LineChart
                    data={p.points}
                    margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                    syncId="district-multiples"
                    onMouseMove={(state) => {
                      const index = state?.activeTooltipIndex;
                      setActive(index == null ? null : Number(index));
                    }}
                  >
                    <YAxis hide domain={[0, max || 1]} />
                    {/* The cursor and the active dots, never a box: the values are in the headers. */}
                    <ChartTooltip
                      cursor={{ stroke: "var(--muted-foreground)" }}
                      content={() => null}
                    />
                    {!keys && (
                      <Line
                        dataKey="overall"
                        stroke="var(--context-muted)"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                    {drawn.map((key) => {
                      const color = colorOf(key);
                      return (
                        <Line
                          key={key}
                          dataKey={key}
                          stroke={color}
                          strokeWidth={1.75}
                          isAnimationActive={false}
                          // A month without a value draws no dot; one on few landings is hollow.
                          dot={({ cx, cy, value, payload, index }: DotProps) =>
                            value == null || cy == null ? (
                              <g key={index} />
                            ) : (
                              <circle
                                key={index}
                                cx={cx}
                                cy={cy}
                                r={2.5}
                                stroke={color}
                                strokeWidth={1.5}
                                fill={payload?.thin ? "var(--background)" : color}
                              />
                            )
                          }
                        />
                      );
                    })}
                  </LineChart>
                </ChartContainer>
                <span className={cn("flex items-center gap-1 text-xs text-muted-foreground")}>
                  {thin && <WarningIcon label={t("text-scope-few-landings")} />}
                  {landingsCount(t, lang, p.landings)}
                </span>
              </div>
            );
          })}
        </div>
      </ChartGate>
    </ChartCard>
  );
}
