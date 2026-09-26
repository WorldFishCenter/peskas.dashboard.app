import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import { categoryChartHeight } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { truncateLabel } from "@/lib/dashboard/format";

/** One bar: its value, a line of context for the tooltip, and whether it rests on too little data. */
export type RankedRow = { label: string; value: number; detail?: string; thin?: boolean };

/** Horizontal bars in the given order, each labelled with its value; thin rows are drawn faded. */
export function RankedBars({
  rows,
  name,
  format,
  color = "var(--primary)",
}: {
  rows: RankedRow[];
  name: string;
  format: (value: number) => string;
  color?: string;
}) {
  return (
    <ChartContainer
      config={{ value: { label: name } }}
      className="aspect-auto w-full"
      style={{ height: categoryChartHeight(rows.length) }}
    >
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ right: 64 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => format(v)} />
        <YAxis
          dataKey="label"
          type="category"
          width={140}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => truncateLabel(v, 18)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(_value, _name, item) => {
                const row = item.payload as RankedRow;
                return (
                  <div className="grid w-full gap-1.5">
                    <div className="font-medium">{row.label}</div>
                    <TooltipRow label={name} value={format(row.value)} />
                    {row.detail && <div className="text-muted-foreground">{row.detail}</div>}
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
          {rows.map((row) => (
            <Cell key={row.label} fill={color} fillOpacity={row.thin ? 0.35 : 1} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(v) => format(Number(v))} className="fill-foreground" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
