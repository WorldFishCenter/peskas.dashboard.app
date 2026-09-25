import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { Treemap } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import type { MetricKey } from "@repo/domain/metrics";
import { metricUnit } from "@/lib/dashboard/metrics";
import { getTextColor, TREEMAP_COLORS } from "@/lib/dashboard/palettes";
import { districtsAtom } from "@/store/filters";
import { monthsAtom } from "@/store/time-range";
import { api } from "@/trpc/react";


// Label keys per metric the gear summaries carry.
const LABELS: Partial<Record<MetricKey, { titleKey: string; averageKey: string }>> = {
  mean_cpue: { titleKey: "text-cpue-by-gear", averageKey: "text-average-cpue" },
  mean_rpue: { titleKey: "text-rpue-by-gear", averageKey: "text-average-rpue" },
};

type GearTile = {
  name: string;
  size: number;
  fill: string;
  records: number;
  districts: number;
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
export function GearTreemap({ metric, className }: { metric: MetricKey; className?: string }) {
  const { t, lang } = useT();
  const districts = useAtomValue(districtsAtom);
  const months = useAtomValue(monthsAtom);
  const { data, isLoading, error } = api.summaries.byGear.useQuery(
    { districts, months, metric },
    { enabled: districts.length > 0 }
  );

  const labels = LABELS[metric]!;
  const unit = metricUnit(t, metric);
  const format = (v: number) => `${v.toLocaleString(lang, { maximumFractionDigits: 2 })} ${unit}`;

  // Server order (value descending) decides the colours.
  const tiles: GearTile[] = useMemo(
    () =>
      (data ?? [])
        .map((item) => ({
          name: item.gear ? titleCase(item.gear.replace(/_/g, " ")) : t("text-unknown"),
          size: Number(item.value.toFixed(2)),
          records: item.records,
          districts: item.districts,
        }))
        .filter((d) => d.size > 0)
        .map((d, i) => ({ ...d, fill: TREEMAP_COLORS[i % TREEMAP_COLORS.length] })),
    [data, t]
  );

  const chartConfig = { size: { label: t(labels.averageKey) } } satisfies ChartConfig;

  return (
    <ChartCard className={className} title={t(labels.titleKey)}>
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
                        {tile.districts > 0 && (
                          <TooltipRow label={t("text-districts")} value={tile.districts} />
                        )}
                        {tile.records > 0 && (
                          <TooltipRow label={t("text-records")} value={tile.records.toLocaleString(lang)} />
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
