import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { categoryChartHeight, ChartGate } from "@/components/charts/chart-state";
import { SeriesLegend, type Series } from "@/components/charts/series-legend";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { truncateLabel } from "@/lib/dashboard/format";
import { OTHERS_COLOR, SPECIES_COLORS } from "@/lib/dashboard/palettes";
import { districtsAtom } from "@/store/filters";
import { monthsAtom } from "@/store/time-range";
import { api } from "@/trpc/react";

const OTHERS = "__others";
const TOP_N = 10;

type Mode = "relative" | "absolute";

const tonnes = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(1));

// Share of each district's catch, or catch in tonnes.
const MODES = {
  relative: {
    axisKey: "text-percentage",
    toDisplay: (v: number, total: number) => (v / total) * 100,
    domain: [0, 100] as [number, number],
    tick: (v: number) => `${Math.round(v)}%`,
    format: (v: number) => `${v.toFixed(1)}%`,
  },
  absolute: {
    axisKey: "text-catch-tonnes",
    toDisplay: (v: number) => v,
    domain: [0, (max: number) => Math.ceil(max * 10) / 10] as [number, (max: number) => number],
    tick: (v: number) => v.toFixed(1),
    format: tonnes,
  },
} satisfies Record<Mode, unknown>;
type Row = { name: string } & Record<string, number | null | string>;

/** Share of catch by species in each selected district: top 10 species plus "Others". */
export function SpeciesComposition({ className }: { className?: string }) {
  const { t } = useT();
  const districts = useAtomValue(districtsAtom);
  const months = useAtomValue(monthsAtom);
  const [mode, setMode] = useState<Mode>("relative");
  const [hidden, setHidden] = useState<string[]>([]);

  const { data, isLoading, error } = api.summaries.composition.useQuery(
    { districts, metric: "catch_kg", months },
    { enabled: districts.length > 0 }
  );

  const { rows, species } = useMemo(() => {
    const all = data ?? []; // largest total first
    const top = all.slice(0, TOP_N);
    const rest = all.slice(TOP_N);
    const districtValue = (s: (typeof all)[number], district: string) =>
      s.districts.find((d) => d.district === district)?.value ?? 0;

    const rows: Row[] = districts
      .map((district) => {
        // kg → tonnes
        const values: Record<string, number> = Object.fromEntries(
          top.map((s) => [s.taxon ?? t("text-unknown"), districtValue(s, district) / 1000])
        );
        values[OTHERS] = rest.reduce((sum, s) => sum + districtValue(s, district), 0) / 1000;
        const total = Object.values(values).reduce((a, b) => a + b, 0);
        const shown = Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, v > 0 ? MODES[mode].toDisplay(v, total) : null])
        );
        return { name: district, total, ...shown };
      })
      .filter((row) => row.total > 0);

    const species: Series[] = [
      ...top.map((s, i) => ({ key: s.taxon ?? t("text-unknown"), color: SPECIES_COLORS[i % SPECIES_COLORS.length] })),
      { key: OTHERS, label: t("text-others"), color: OTHERS_COLOR },
    ];
    return { rows, species };
  }, [data, districts, mode, t]);

  const { format, domain, tick, axisKey } = MODES[mode];
  const chartConfig = Object.fromEntries(species.map((s) => [s.key, { label: s.label ?? s.key }])) satisfies ChartConfig;
  const visible = species.filter((s) => !hidden.includes(s.key));

  return (
    <ChartCard
      className={className}
      title={t("text-species-composition")}
      action={
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[mode]}
          onValueChange={(v) => v[0] && setMode(v[0] as Mode)}
        >
          <ToggleGroupItem value="relative">%</ToggleGroupItem>
          <ToggleGroupItem value="absolute">{t("text-catch-tonnes")}</ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <ChartGate isLoading={isLoading} error={error} isEmpty={!rows.length} emptyDescription={t("text-no-data-available-for-districts")}>
        <>
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full"
            style={{ height: categoryChartHeight(rows.length, 40) }}
          >
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ right: 20, bottom: 24 }}>
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                domain={domain}
                tickFormatter={tick}
                label={{
                  value: t(axisKey),
                  position: "insideBottom",
                  offset: -16,
                  className: "fill-muted-foreground",
                }}
              />
              <YAxis dataKey="name" type="category" width={120} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncateLabel(v)} />
              <ChartTooltip
                itemSorter={(item) => -(Number(item.value) || 0)}
                content={
                  <ChartTooltipContent
                    labelFormatter={(label, payload) => {
                      const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
                      return (
                        <div className="grid gap-0.5">
                          <span>{label}</span>
                          <span className="font-normal text-muted-foreground">
                            {t("text-total")}: {format(total)}
                          </span>
                        </div>
                      );
                    }}
                    formatter={(value, name, item) => {
                      const row = item.payload as Row;
                      const visibleTotal = visible.reduce((sum, s) => sum + (Number(row[s.key]) || 0), 0);
                      const share = visibleTotal ? (Number(value) / visibleTotal) * 100 : 0;
                      return (
                        <TooltipRow
                          color={item.color}
                          label={chartConfig[String(name)]?.label ?? name}
                          value={`${format(Number(value))} (${share.toFixed(1)}%)`}
                        />
                      );
                    }}
                  />
                }
              />
              {species.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="species"
                  fill={s.color}
                  hide={hidden.includes(s.key)}
                  radius={s.key === OTHERS ? [0, 4, 4, 0] : 0}
                  animationDuration={1000}
                />
              ))}
            </BarChart>
          </ChartContainer>
          <SeriesLegend
            series={species}
            hidden={hidden}
            // "Others" always stays visible.
            onHiddenChange={(next) => setHidden(next.filter((k) => k !== OTHERS))}
          />
        </>
      </ChartGate>
    </ChartCard>
  );
}
