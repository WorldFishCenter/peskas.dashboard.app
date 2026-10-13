import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  XAxis,
  YAxis,
} from "recharts";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { MessageFooter } from "@workspace/ui/components/message";
import { Table, TableBody, TableCell, TableRow } from "@workspace/ui/components/table";
import { METRICS, type MetricKey } from "@repo/domain/metrics";
import type { Answer } from "@/components/askfish/panel";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartState, RenderGuard } from "@/components/charts/chart-state";
import { RankedBars } from "@/components/charts/ranked-bars";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { useT } from "@/i18n/use-lang";
import {
  formatNumber,
  formatTick,
  monthAxis,
  monthLabel,
  monthSpan,
  monthTooltipLabel,
} from "@/lib/dashboard/format";
import { formatValue, METHOD_COLOR } from "@/lib/dashboard/metrics";
import { useSpeciesName } from "@/lib/dashboard/species";

type Chart = Answer["charts"][number];
type Format = (value: number) => string;

/** Every x value of some series (months, say), once each and in order. */
const xValues = (series: Chart["series"]) =>
  [...new Set(series.flatMap((s) => s.points.map((p) => String(p.x))))].sort();

/**
 * A figure as the dashboard writes it everywhere: by its metric (an estimate
 * rounded, with ≈) when it is in one, else as recorded.
 */
const figure = (metric: MetricKey | null, value: number, lang: string) =>
  metric ? formatValue(metric, value, lang) : formatNumber(value, lang);

/** What AskFish found: its words, the figures behind them, its charts, what to keep in mind and the data it read. */
export function AnswerView({ answer }: { answer: Answer }) {
  const { t, lang } = useT();
  // A species goes by its common name, as on the pages, with the scientific one beside it.
  const name = useSpeciesName();
  // AskFish reads the GPS tracker method's estimates only; the pages show both methods'.
  const caveats = [
    ...(answer.estimated ? [t("text-askfish-tracker-only")] : []),
    ...answer.caveats,
  ];

  return (
    <>
      <Bubble variant="ghost">
        <BubbleContent className="flex flex-col gap-1.5">
          <p className="font-medium">{answer.headline}</p>
          <p className="whitespace-pre-line">{answer.narrative}</p>
        </BubbleContent>
      </Bubble>
      {answer.statistics.length > 0 && (
        <Table>
          <TableBody>
            {answer.statistics.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="whitespace-normal">
                  {name(s.label)}
                  {[name(s.label) !== s.label && s.label, s.detail].filter(Boolean).map((note) => (
                    <span key={String(note)} className="text-muted-foreground">
                      {" · "}
                      {note}
                    </span>
                  ))}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {s.value == null ? "-" : figure(s.metric, s.value, lang)}
                  {s.unit && <span className="font-normal text-muted-foreground"> {s.unit}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {answer.charts.map((chart, i) => (
        <AnswerChart key={i} chart={chart} />
      ))}
      {caveats.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
          {caveats.map((caveat, i) => (
            <li key={i}>{caveat}</li>
          ))}
        </ul>
      )}
      {answer.sources.length > 0 && (
        <MessageFooter className="flex-wrap gap-x-3 gap-y-1">
          {answer.sources.map((s, i) => (
            <span key={i}>
              {t("text-askfish-source", {
                label: s.label,
                count: s.records,
                formatted: formatNumber(s.records, lang),
              })}
              {s.from && s.through
                ? ` · ${monthSpan(s.from, s.through, lang)}`
                : s.through &&
                  ` · ${t("text-askfish-through", { month: monthLabel(s.through, lang, "long") })}`}
            </span>
          ))}
        </MessageFooter>
      )}
    </>
  );
}

/** One of AskFish's charts in the dashboard's own card, with its rows to download. */
function AnswerChart({ chart }: { chart: Chart }) {
  const { t, lang } = useT();
  const name = useSpeciesName();
  const { x, y } = chart.metrics;
  const format: Format = (value) => figure(y, value, lang);
  // What is drawn from an estimate wears its method's colour, a recorded figure the dashboard's first.
  const estimated = [x, y].some((m) => m && METRICS[m].estimated);
  const color = estimated ? METHOD_COLOR.tracker : "var(--chart-1)";
  const marks = chart.series.filter((s) => !s.trend);
  const draw = () => {
    if (!marks.some((s) => s.points.length)) return null;
    if (chart.type === "line") {
      return marks.length > 1 ? (
        <Multiples
          series={marks.map((s) => ({ ...s, name: name(s.name) }))}
          byMonth={chart.byMonth}
          format={format}
          color={color}
        />
      ) : (
        <Trend chart={chart} format={format} color={color} />
      );
    }
    if (chart.type === "bar") {
      return (
        <RankedBars
          rows={marks[0].points.map((p) => {
            const label = name(String(p.x));
            return { label, value: p.y, detail: label === p.x ? undefined : String(p.x) };
          })}
          name={marks[0].name}
          format={format}
          color={color}
        />
      );
    }
    if (chart.type === "stacked_bar") return <Stacked chart={chart} />;
    if (chart.type === "scatter" || chart.type === "quadrant") {
      return <Points chart={chart} color={color} />;
    }
    // A kind of chart AskFish added since: its figures are still in the answer.
    return null;
  };
  const drawn = draw();
  if (!drawn) return null;

  return (
    <ChartCard
      id={`askfish-${chart.type}`}
      title={chart.title}
      info="info-askfish-chart"
      // The method goes beside the axis it describes: the subtitle names the y axis.
      description={[chart.yLabel, y && METRICS[y].estimated && t("text-method-tracker")]
        .filter(Boolean)
        .join(" · ")}
      download={chart.series.flatMap((s) =>
        s.points.map((p) => ({ series: s.name, [chart.xLabel ?? "x"]: p.x, value: p.y })),
      )}
      footer={chart.note}
    >
      {/* A chart that can't be drawn blanks itself, not the conversation. */}
      <RenderGuard fallback={<ChartState status="error" />}>{drawn}</RenderGuard>
    </ChartCard>
  );
}

/** One series over the months, like the pages' trend. */
function Trend({ chart, format, color }: { chart: Chart; format: Format; color: string }) {
  const { lang } = useT();
  const [series] = chart.series;
  const rows = series.points.map((p) => ({ month: String(p.x), value: p.y }));
  return (
    <ChartContainer
      config={{ value: { label: series.name } }}
      className={`aspect-auto w-full ${CHART_HEIGHT}`}
    >
      <LineChart accessibilityLayer data={rows} margin={{ top: 8, right: 12 }}>
        <CartesianGrid vertical={false} />
        {chart.byMonth ? (
          <XAxis {...monthAxis(lang)} interval="preserveStartEnd" />
        ) : (
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        )}
        <YAxis
          tickLine={false}
          axisLine={false}
          width="auto"
          niceTicks="snap125"
          domain={[0, "dataMax"]}
          tickFormatter={(v: number) => formatTick(v, lang)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={chart.byMonth ? monthTooltipLabel(lang) : undefined}
              formatter={(value, _name, item) => (
                <TooltipRow color={item.color} label={series.name} value={format(Number(value))} />
              )}
            />
          }
        />
        <Line
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          dot={rows.length <= 18 ? { r: 3, fill: color } : false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

/**
 * Several series over the months as one small chart each on a shared axis,
 * the way the pages draw districts: no colour per district, no crossing
 * lines. Pointing at a month reads its value beside every name.
 */
function Multiples({
  series,
  byMonth: monthly,
  format,
  color,
}: {
  series: Chart["series"];
  byMonth: boolean;
  format: Format;
  color: string;
}) {
  const { t, lang } = useT();
  const [active, setActive] = useState<number | null>(null);
  // Built once per answer, not per month pointed at: each panel keeps its data, so only
  // its cursor moves (as in the pages' DistrictMultiples).
  const { months, max, panels } = useMemo(() => {
    // Every panel spans the same months, with a gap where a series has none.
    const months = xValues(series);
    return {
      months,
      max: Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.y))),
      panels: series.map((s) => {
        const values = new Map(s.points.map((p) => [String(p.x), p.y]));
        return {
          name: s.name,
          points: months.map((month) => ({ month, value: values.get(month) })),
        };
      }),
    };
  }, [series]);

  return (
    <>
      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {active != null && months[active]
          ? monthly
            ? monthLabel(months[active], lang, "long")
            : months[active]
          : monthly && months.length > 1
            ? `${monthSpan(months[0], months.at(-1)!, lang)} · ${t("text-askfish-point")}`
            : t("text-askfish-point")}
      </p>
      <div
        className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3"
        onMouseLeave={() => setActive(null)}
      >
        {panels.map((p) => {
          // The month pointed at, else the latest with a value.
          const shown =
            active == null ? p.points.findLast((x) => x.value != null) : p.points[active];
          return (
            <div key={p.name} className="flex min-w-0 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate font-medium" title={p.name}>
                  {p.name}
                </span>
                <span className="tabular-nums">
                  {shown?.value == null ? "-" : format(shown.value)}
                </span>
              </div>
              <ChartContainer
                config={{ value: { label: p.name } }}
                className="aspect-auto h-16 w-full"
              >
                <LineChart
                  data={p.points}
                  margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                  syncId="askfish-multiples"
                  onMouseMove={(state) => {
                    const index = state?.activeTooltipIndex;
                    setActive(index == null ? null : Number(index));
                  }}
                >
                  <YAxis hide domain={[0, max || 1]} />
                  {/* The cursor only: the values are beside the names. */}
                  <ChartTooltip
                    cursor={{ stroke: "var(--muted-foreground)" }}
                    content={() => null}
                  />
                  <Line
                    dataKey="value"
                    stroke={color}
                    strokeWidth={1.75}
                    dot={{ r: 2, fill: color }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Counts stacked per month: how many values AskFish found and how many are missing. */
function Stacked({ chart }: { chart: Chart }) {
  const { lang } = useT();
  // What was found and what is missing: one bar in two shades of the recorded figures' colour.
  const colors = ["var(--chart-1)", "color-mix(in oklab, var(--chart-1) 30%, transparent)"];
  const rows = xValues(chart.series).map((month) => ({
    month,
    ...Object.fromEntries(
      chart.series.map((s, i) => [`s${i}`, s.points.find((p) => String(p.x) === month)?.y ?? 0]),
    ),
  }));
  return (
    <ChartContainer
      config={Object.fromEntries(chart.series.map((s, i) => [`s${i}`, { label: s.name }]))}
      className={`aspect-auto w-full ${CHART_HEIGHT}`}
    >
      <BarChart accessibilityLayer data={rows} margin={{ top: 8, right: 12 }}>
        <CartesianGrid vertical={false} />
        {chart.byMonth ? (
          <XAxis {...monthAxis(lang)} />
        ) : (
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        )}
        <YAxis tickLine={false} axisLine={false} width="auto" allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={chart.byMonth ? monthTooltipLabel(lang) : undefined}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {chart.series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={`s${i}`}
            stackId="all"
            fill={colors[i % colors.length]}
            maxBarSize={32}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/**
 * One point per observation or group, two measures against each other: a
 * relationship with its trend line, or changes around zero with each point named.
 */
function Points({ chart, color }: { chart: Chart; color: string }) {
  const { lang } = useT();
  const named = chart.type === "quadrant";
  const points = chart.series
    .filter((s) => !s.trend)
    .flatMap((s) => s.points.map((p) => ({ x: Number(p.x), y: p.y, name: p.label ?? s.name })));
  const trend = chart.series.find((s) => s.trend)?.points.map((p) => ({ x: Number(p.x), y: p.y }));
  const tick = (v: number) => formatTick(v, lang);
  return (
    <ChartContainer
      config={{ y: { label: chart.yLabel ?? "" }, x: { label: chart.xLabel ?? "" } }}
      className={`aspect-auto w-full ${CHART_HEIGHT}`}
    >
      <ComposedChart accessibilityLayer margin={{ top: 16, right: 16, bottom: 16 }}>
        <CartesianGrid />
        <XAxis
          dataKey="x"
          type="number"
          domain={["auto", "auto"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={tick}
          label={{ value: chart.xLabel ?? "", position: "insideBottom", offset: -12 }}
        />
        <YAxis
          dataKey="y"
          type="number"
          domain={["auto", "auto"]}
          tickLine={false}
          axisLine={false}
          width="auto"
          tickFormatter={tick}
        />
        {chart.zero && <ReferenceLine x={0} stroke="var(--border)" />}
        {chart.zero && <ReferenceLine y={0} stroke="var(--border)" />}
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              // The point's name heads the tooltip, then its value on each axis.
              labelFormatter={(_label, items) => items?.[0]?.payload?.name}
              formatter={(value, _name, item) => {
                const axis = item.dataKey === "x" ? "x" : "y";
                return (
                  <TooltipRow
                    label={axis === "x" ? chart.xLabel : chart.yLabel}
                    value={figure(chart.metrics[axis], Number(value), lang)}
                  />
                );
              }}
            />
          }
        />
        {trend && (
          <Line
            data={trend}
            dataKey="y"
            stroke="var(--context)"
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        )}
        <Scatter data={points} fill={color} isAnimationActive={false}>
          {named && (
            <LabelList dataKey="name" position="top" className="fill-foreground" fontSize={11} />
          )}
        </Scatter>
      </ComposedChart>
    </ChartContainer>
  );
}
