"use client";

import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { Treemap } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import { useT } from "@/app/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { metricUnit } from "@/lib/dashboard/metrics";
import { getTextColor, TREEMAP_COLORS } from "@/lib/dashboard/palettes";
import { districtsAtom } from "@/store/filters";
import { monthsAtom } from "@/store/time-range";
import { api } from "@/trpc/react";


// Per-indicator metric (for the translated unit) and label keys.
const INDICATORS = {
  cpue: { metric: "mean_cpue", titleKey: "text-cpue-by-gear", averageKey: "text-average-cpue" },
  rpue: { metric: "mean_rpue", titleKey: "text-rpue-by-gear", averageKey: "text-average-rpue" },
} as const;

type GearTile = {
  name: string;
  size: number;
  fill: string;
  total_records: number;
  district_count: number;
};

const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

/** Tile renderer: coloured rect plus name and value when the tile is large enough. */
function Tile(props: { x?: number; y?: number; width?: number; height?: number; depth?: number } & Partial<GearTile> & {
  format: (v: number) => string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, depth, name, size, fill, format } = props;
  if (depth !== 1 || !fill) return null;
  const color = getTextColor(fill);
  // Room for the longest value line (e.g. "0.85 kg/fisher/hour") at text-xs.
  const showText = width > 130 && height > 36;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="var(--background)" strokeWidth={2} />
      {showText && (
        <>
          <text x={x + 8} y={y + 18} fill={color} className="text-xs font-semibold">
            {name}
          </text>
          <text x={x + 8} y={y + 34} fill={color} className="text-xs">
            {format(size ?? 0)}
          </text>
        </>
      )}
    </g>
  );
}

/** Average CPUE or RPUE per gear type, sized by value. */
export function GearTreemap({ metric, className }: { metric: "cpue" | "rpue"; className?: string }) {
  const { t, lang } = useT();
  const districts = useAtomValue(districtsAtom);
  const months = useAtomValue(monthsAtom);
  const { data, isLoading, error } = api.gear.byGear.useQuery(
    { districts, months, indicator: metric },
    { enabled: districts.length > 0 }
  );

  const indicator = INDICATORS[metric];
  const unit = metricUnit(t, indicator.metric);
  const format = (v: number) => `${v.toLocaleString(lang, { maximumFractionDigits: 2 })} ${unit}`;

  // Server order (value descending) decides the colours.
  const tiles: GearTile[] = useMemo(
    () =>
      ((data ?? []) as Record<string, unknown>[])
        .map((item) => ({
          name: titleCase(String(item.gear ?? "").replace(/_/g, " ")) || t("text-unknown"),
          size: Number((Number(item[`avg_${metric}`]) || 0).toFixed(2)),
          total_records: Number(item.total_records) || 0,
          district_count: Number(item.district_count) || 0,
        }))
        .filter((d) => d.size > 0)
        .map((d, i) => ({ ...d, fill: TREEMAP_COLORS[i % TREEMAP_COLORS.length] })),
    [data, metric, t]
  );

  const chartConfig = { size: { label: t(indicator.averageKey) } } satisfies ChartConfig;

  return (
    <ChartCard className={className} title={t(indicator.titleKey)}>
      <ChartGate isLoading={isLoading} error={error} isEmpty={!tiles.length} className={CHART_HEIGHT}>
        <ChartContainer config={chartConfig} className={`aspect-auto w-full ${CHART_HEIGHT}`}>
          <Treemap data={tiles} dataKey="size" nameKey="name" content={<Tile format={format} />} animationDuration={800}>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(_value, _name, item) => {
                    const tile = item.payload as GearTile;
                    return (
                      <div className="grid w-full gap-1.5">
                        <div className="font-medium">{tile.name}</div>
                        <TooltipRow color={tile.fill} label={chartConfig.size.label} value={format(tile.size)} />
                        {tile.district_count > 0 && (
                          <TooltipRow label={t("text-districts")} value={tile.district_count} />
                        )}
                        {tile.total_records > 0 && (
                          <TooltipRow label={t("text-records")} value={tile.total_records.toLocaleString(lang)} />
                        )}
                      </div>
                    );
                  }}
                />
              }
            />
          </Treemap>
        </ChartContainer>
      </ChartGate>
    </ChartCard>
  );
}
