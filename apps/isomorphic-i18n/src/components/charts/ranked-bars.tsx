import { useSyncExternalStore } from "react";
import { scaleLinear } from "d3-scale";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { categoryChartHeight } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { truncateLabel } from "@/lib/dashboard/format";

/**
 * One bar: its value, a line of context for the tooltip, and whether it rests
 * on too little data; with a `compare` series, the second bar's value and label.
 */
export type RankedRow = {
  label: string;
  value: number;
  detail?: string;
  thin?: boolean;
  compare?: number | null;
  compareLabel?: string;
};

/** The second bar under each row: another measure of the same rows, on the same axis. */
export type CompareSeries = { name: string; color: string };

/** Narrower than Tailwind's `sm`: a phone, where a long bar label would squeeze the bars. */
const NARROW = "(max-width: 639px)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useNarrow = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );

/**
 * Horizontal bars in the given order, each labelled with its value; thin rows
 * are drawn faded. With `compare`, each row gets a second bar under the first,
 * labelled with its `compareLabel` (on a phone with its value alone, the label
 * staying in the tooltip), and the chart a legend. The right margin fits the
 * longest label.
 */
export function RankedBars({
  rows,
  name,
  format,
  color = "var(--primary)",
  compare,
}: {
  rows: RankedRow[];
  name: string;
  format: (value: number) => string;
  color?: string;
  compare?: CompareSeries;
}) {
  const narrow = useNarrow();
  const ticks = scaleLinear()
    .domain([0, Math.max(0, ...rows.flatMap((r) => [r.value, r.compare ?? 0]))])
    .nice(4)
    .ticks(4);
  const compareText = (row: RankedRow) =>
    row.compare == null ? "" : narrow ? format(row.compare) : row.compareLabel ?? "";
  // About 7px a character at the labels' 12px.
  const longest = Math.max(
    ...rows.map((r) => Math.max(format(r.value).length, compareText(r).length)),
  );
  return (
    <ChartContainer
      config={{
        value: { label: name },
        ...(compare && { compare: { label: compare.name } }),
      }}
      className="aspect-auto w-full"
      style={{ height: categoryChartHeight(rows.length, compare ? 44 : 28) + (compare ? 24 : 0) }}
    >
      <BarChart
        accessibilityLayer
        data={rows}
        layout="vertical"
        margin={{ right: Math.max(64, 16 + 7 * longest) }}
        barGap={2}
      >
        <CartesianGrid horizontal={false} />
        {/* Round ticks that end just past the longest bar, not a whole step beyond it. */}
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          domain={[0, ticks.at(-1) ?? "auto"]}
          ticks={ticks}
          tickFormatter={(v: number) => format(v)}
        />
        <YAxis
          dataKey="label"
          type="category"
          width={180}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => truncateLabel(v, 24)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              // The tooltip's own heading is the bar's name, so the rows start at its value; drawn once for both bars.
              formatter={(_value, _name, item, index) => {
                if (index > 0) return null;
                const row = item.payload as RankedRow;
                return (
                  <div className="grid w-full gap-1.5">
                    <TooltipRow color={compare && color} label={name} value={format(row.value)} />
                    {compare && row.compare != null && (
                      <TooltipRow
                        color={compare.color}
                        label={compare.name}
                        value={row.compareLabel}
                      />
                    )}
                    {row.detail && <div className="text-muted-foreground">{row.detail}</div>}
                  </div>
                );
              }}
            />
          }
        />
        {/* The first bar's measure first. */}
        {compare && (
          <ChartLegend
            content={<ChartLegendContent />}
            itemSorter={(item) => (item.dataKey === "value" ? 0 : 1)}
          />
        )}
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={compare ? 16 : 24} fill={color}>
          {rows.map((row) => (
            <Cell key={row.label} fill={color} fillOpacity={row.thin ? 0.35 : 1} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => format(Number(v))}
            className="fill-foreground"
          />
        </Bar>
        {compare && (
          <Bar dataKey="compare" radius={[0, 6, 6, 0]} maxBarSize={16} fill={compare.color}>
            <LabelList
              position="right"
              className="fill-foreground"
              valueAccessor={(entry: { payload: RankedRow }) => compareText(entry.payload)}
            />
          </Bar>
        )}
      </BarChart>
    </ChartContainer>
  );
}
