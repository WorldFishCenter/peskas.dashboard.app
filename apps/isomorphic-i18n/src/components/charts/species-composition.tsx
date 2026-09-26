import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import type { RouterOutputs } from "@isomorphic/api";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { categoryChartHeight, ChartGate } from "@/components/charts/chart-state";
import { useSeriesToggle, type Series } from "@/components/charts/series-legend";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { gearLabel, truncateLabel } from "@/lib/dashboard/format";
import { compositionInfo } from "@/lib/dashboard/metrics";
import { OTHERS_COLOR, SPECIES_COLORS } from "@/lib/dashboard/palettes";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

const OTHERS = "__others";
const TOP_N = 10;

type Mode = "relative" | "absolute";

const tonnes = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(1));

// Share of each group's catch, or catch in tonnes.
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
type CompositionRow = RouterOutputs["summaries"]["composition"][number];

/**
 * Recorded catch by species in each group (a district or a gear): the top 10
 * species plus "Others", as shares or tonnes.
 */
function CompositionChart({
  id,
  title,
  query,
  data,
  groups,
  emptyDescription,
  className,
}: {
  id: string;
  title: string;
  query: Parameters<typeof ChartGate>[0]["query"];
  data: CompositionRow[] | undefined;
  groups: { key: string | null; label: string }[];
  emptyDescription: string;
  className?: string;
}) {
  const { t } = useT();
  const scope = useDistrictScope();
  const [mode, setMode] = useState<Mode>("relative");

  const { rows, species } = useMemo(() => {
    const all = data ?? []; // largest total first
    const top = all.slice(0, TOP_N);
    const rest = all.slice(TOP_N);
    const groupValue = (s: CompositionRow, group: string | null) => s.groups.find((g) => g.group === group)?.value ?? 0;

    const rows: Row[] = groups
      .map(({ key, label }) => {
        // kg → tonnes
        const values: Record<string, number> = Object.fromEntries(
          top.map((s) => [s.taxon ?? t("text-unknown"), groupValue(s, key) / 1000])
        );
        values[OTHERS] = rest.reduce((sum, s) => sum + groupValue(s, key), 0) / 1000;
        const total = Object.values(values).reduce((a, b) => a + b, 0);
        const shown = Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, v > 0 ? MODES[mode].toDisplay(v, total) : null])
        );
        return { name: label, total, ...shown };
      })
      .filter((row) => row.total > 0);

    const species: Series[] = [
      ...top.map((s, i) => ({ key: s.taxon ?? t("text-unknown"), color: SPECIES_COLORS[i % SPECIES_COLORS.length] })),
      { key: OTHERS, label: t("text-others"), color: OTHERS_COLOR },
    ];
    return { rows, species };
  }, [data, groups, mode, t]);

  const { format, domain, tick, axisKey } = MODES[mode];
  // "Others" always stays visible.
  const { chartConfig, isHidden, legend } = useSeriesToggle(species, [OTHERS]);
  const visible = species.filter((s) => !isHidden(s.key));

  return (
    <ChartCard
      id={id}
      className={className}
      title={title}
      description={t("text-species-composition-description")}
      info={compositionInfo(t)}
      download={(data ?? []).flatMap((s) => s.groups.map((g) => ({ taxon: s.taxon, group: g.group, recorded_catch_kg: g.value })))}
      scope={scope}
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
      <ChartGate query={query} isEmpty={!rows.length} emptyDescription={emptyDescription}>
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
                  hide={isHidden(s.key)}
                  radius={s.key === OTHERS ? [0, 4, 4, 0] : 0}
                  animationDuration={1000}
                />
              ))}
            </BarChart>
          </ChartContainer>
          {legend}
        </>
      </ChartGate>
    </ChartCard>
  );
}

/** Recorded catch by species in each selected district. */
export function SpeciesComposition({ className }: { className?: string }) {
  const { t } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.composition.useQuery({ ...scope.input, metric: "catch_kg" }, scope.options);
  const groups = useMemo(() => scope.input.districts.map((d) => ({ key: d, label: d })), [scope.input.districts]);
  return (
    <CompositionChart
      id="species-composition"
      className={className}
      title={t("title-species-composition")}
      query={query}
      data={query.data}
      groups={groups}
      emptyDescription={t("text-no-data-available-for-districts")}
    />
  );
}

/** Recorded catch by species for each gear. */
export function GearSpeciesComposition({ className }: { className?: string }) {
  const { t } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.gearComposition.useQuery(scope.input, scope.options);
  const groups = useMemo(() => {
    const gears = new Map<string | null, number>();
    for (const s of query.data?.rows ?? []) for (const g of s.groups) gears.set(g.group, (gears.get(g.group) ?? 0) + g.value);
    return [...gears]
      .sort(([, a], [, b]) => b - a)
      .map(([key]) => ({ key, label: gearLabel(key, t("text-unknown")) }));
  }, [query.data, t]);
  return (
    <CompositionChart
      id="gear-species"
      className={className}
      title={t("title-gear-species")}
      query={query}
      data={query.data?.rows}
      groups={groups}
      emptyDescription={t(query.data?.available === false ? "text-gear-species-not-published" : "text-no-data-available-for-filters")}
    />
  );
}
