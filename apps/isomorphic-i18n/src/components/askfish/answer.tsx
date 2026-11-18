import { useId, useMemo, useState } from "react";
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
  ScatterChart,
  ZAxis,
  XAxis,
  YAxis,
} from "recharts";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { answerText, downloadAnswerCsv } from "./answer-export";
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
import { groupedBarRows, pairedEndpointSeries, valueAxisDomain, heatmapGrid, type ChartBarSeries } from "./askfish-chart-data";

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
  const [copied, setCopied] = useState(false);
  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(answerText(answer));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
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
      <div className="flex flex-wrap gap-2 px-4 pb-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copyAnswer()}>
          <CopyIcon className="size-3.5" />
          {copied ? t("text-askfish-copied") : t("text-askfish-copy-answer")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => downloadAnswerCsv(answer)}>
          <DownloadIcon className="size-3.5" />
          {t("text-askfish-export-csv")}
        </Button>
      </div>
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
      // Keep each observed series; the earlier renderer silently dropped all
      // but marks[0]. Pair matching temporal endpoints side by side instead
      // of showing alternating district/date labels as unrelated categories.
      const endpointSeries = marks.length === 1 ? pairedEndpointSeries(marks[0]) : null;
      if (marks.length > 1 || endpointSeries) {
        return (
          <GroupedBars
            series={(endpointSeries ?? marks).map((s) => ({ ...s, name: name(s.name) }))}
            byMonth={chart.byMonth && !endpointSeries}
            format={format}
          />
        );
      }
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
    if (chart.type === "heatmap") return <Heatmap chart={chart} format={format} />;
    if (chart.type === "stacked_bar") return <Stacked chart={chart} />;
    if (chart.type === "bubble") return <BubblePoints chart={chart} />;
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
        s.points.map((p) => ({ series: s.name, [chart.xLabel ?? "x"]: p.x, value: p.y,
          ...(p.z != null ? { [chart.sizeLabel ?? "size"]: p.z } : {}) })),
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
          domain={valueAxisDomain(rows.map((row) => row.value))}
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
 * Compare multiple observed bar series without dropping series or substituting
 * zeros for missing values. Endpoint comparison uses this same renderer after
 * the two dates are split into separate, side-by-side series.
 */
function GroupedBars({
  series,
  byMonth,
  format,
}: {
  series: ChartBarSeries[];
  byMonth: boolean;
  format: Format;
}) {
  const { lang } = useT();
  const rows = useMemo(() => groupedBarRows(series), [series]);
  if (!rows?.length) return <ChartState status="error" />;
  const values = rows.flatMap((row) =>
    series.flatMap((_s, i) => (typeof row[`s${i}`] === "number" ? [row[`s${i}`] as number] : [])),
  );
  const domain = valueAxisDomain(values);
  const config = Object.fromEntries(
    series.map((s, i) => [`s${i}`, { label: s.name, color: `var(--chart-${i % 5 + 1})` }]),
  );
  return (
    <div className="w-full overflow-x-auto">
      <ChartContainer
        config={config}
        className={`aspect-auto ${CHART_HEIGHT} ${rows.length > 8 ? "min-w-[720px]" : "w-full"}`}
      >
        <BarChart accessibilityLayer data={rows} margin={{ top: 8, right: 12, bottom: 16 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="category"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
            tickFormatter={(label: string) =>
              byMonth ? monthLabel(label, lang, "short") : label
            }
          />
          <YAxis
            domain={domain}
            tickLine={false}
            axisLine={false}
            width="auto"
            tickFormatter={(value: number) => formatTick(value, lang)}
          />
          {(domain[0] < 0 || domain[1] === 0) &&
            <ReferenceLine y={0} stroke="var(--border)" />}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={byMonth ? monthTooltipLabel(lang) : undefined}
                formatter={(value, _name, item) => (
                  <TooltipRow
                    color={item.color}
                    label={series[Number(String(item.dataKey).slice(1))]?.name ?? ""}
                    value={format(Number(value))}
                  />
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {series.map((s, i) => (
            <Bar
              key={`${s.name}-${i}`}
              name={s.name}
              dataKey={`s${i}`}
              fill={`var(--chart-${i % 5 + 1})`}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
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
  const syncId = useId(); // Do not synchronize cursors across separate AskFish answers.
  // Built once per answer, not per month pointed at: each panel keeps its data, so only
  // its cursor moves (as in the pages' DistrictMultiples).
  const { months, domain, panels } = useMemo(() => {
    // Every panel spans the same months, with a gap where a series has none.
    const months = xValues(series);
    return {
      months,
      domain: valueAxisDomain(series.flatMap((s) => s.points.map((p) => p.y))),
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
                  syncId={syncId}
                  onMouseMove={(state) => {
                    const index = state?.activeTooltipIndex;
                    setActive(index == null ? null : Number(index));
                  }}
                >
                  <YAxis hide domain={domain} />
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

/** Governed district×month heatmap. Null means no observation, NOT zero catch. */
function Heatmap({ chart, format }: { chart: Chart; format: Format }) {
  const grid = heatmapGrid(chart.series);
  if (!grid) return <ChartState status="error" />;
  const span = grid.max - grid.min;
  const width = `minmax(8rem, 1.5fr) repeat(${grid.periods.length}, minmax(3.5rem, 1fr))`;
  return (
    <div className="w-full overflow-x-auto" role="table" aria-label={chart.title}>
      <div className="grid gap-1 text-xs" style={{ gridTemplateColumns: width,
        minWidth: `${Math.max(350, 125 + grid.periods.length * 58)}px` }}>
        <div className="sticky left-0 z-10 bg-background p-1 font-medium" role="columnheader">
          District / month
        </div>
        {grid.periods.map((period) => (
          <div key={period} className="p-1 text-center text-muted-foreground" role="columnheader">
            {period.slice(0, 7)}
          </div>
        ))}
        {grid.rows.map((row) => (
          <div key={row.name} role="row" className="contents">
            <div role="rowheader" className="sticky left-0 z-10 truncate bg-background p-1 font-medium"
                 title={row.name}>{row.name}</div>
            {row.values.map((value, index) => {
              const fraction = value === null ? 0 : span === 0 ? 0.5 : (value - grid.min) / span;
              const title = `${row.name} · ${grid.periods[index]}: ${value === null ? "Not observed" : format(value)}`;
              return (
                <div key={grid.periods[index]} role="cell" title={title}
                     aria-label={title}
                     className="flex min-h-8 items-center justify-center rounded-sm border border-border/40 px-1 text-center tabular-nums"
                     style={value === null
                       ? { backgroundColor: "var(--muted)" }
                       : { backgroundColor: `color-mix(in oklab, var(--chart-1) ${Math.round(15 + fraction * 65)}%, transparent)` }}>
                  {value === null ? "–" : format(value)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Darker cells indicate higher values within this chart. – means no matched observation, not zero.
      </p>
    </div>
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


/** Three approved measures: X, Y and circle area (Z), joined on exact source keys. */
function BubblePoints({ chart }: { chart: Chart }) {
  const { lang } = useT();
  const series = chart.series.map((s) => ({
    name: s.name,
    rows: s.points.filter((p) => p.z != null && p.z > 0).map((p) => ({
      x: Number(p.x), y: p.y, z: p.z!, name: p.label ?? s.name,
    })),
  }));
  return (
    <ChartContainer
      config={Object.fromEntries(series.map((s, i) => [
        `bubble${i}`, { label: s.name, color: `var(--chart-${i % 5 + 1})` },
      ]))}
      className={`aspect-auto w-full ${CHART_HEIGHT}`}
    >
      <ScatterChart accessibilityLayer margin={{ top: 16, right: 20, bottom: 28, left: 8 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" domain={["auto", "auto"]}
          tickFormatter={(value: number) => formatTick(value, lang)}
          label={{ value: chart.xLabel ?? "", position: "insideBottom", offset: -15 }} />
        <YAxis type="number" dataKey="y" domain={["auto", "auto"]}
          tickFormatter={(value: number) => formatTick(value, lang)} width="auto" />
        <ZAxis type="number" dataKey="z" range={[64, 900]}
          name={chart.sizeLabel ?? "Bubble size"} unit={chart.sizeUnit ?? ""} />
        <ChartTooltip
          cursor={false}
          content={({ active, payload }) => {
            const item = payload?.[0]?.payload as
              | { x: number; y: number; z: number; name: string }
              | undefined;
            if (!active || !item) return null;
            return (
              <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                <p className="font-medium">{item.name}</p>
                <p>{chart.xLabel}: {formatNumber(item.x, lang)}</p>
                <p>{chart.yLabel}: {formatNumber(item.y, lang)}</p>
                <p>{chart.sizeLabel}: {formatNumber(item.z, lang)} {chart.sizeUnit ?? ""}</p>
              </div>
            );
          }}
        />
        {series.map((s, i) => (
          <Scatter key={s.name} name={s.name} data={s.rows}
            fill={`var(--chart-${i % 5 + 1})`} isAnimationActive={false} />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </ScatterChart>
    </ChartContainer>
  );
}
