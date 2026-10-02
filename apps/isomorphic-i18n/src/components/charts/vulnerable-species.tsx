import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import type { RouterOutputs } from "@isomorphic/api";
import { VULNERABILITY_BANDS } from "@repo/domain/metrics";
import { useT } from "@/i18n/use-lang";
import { Legend } from "@/components/charts/legend";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { StatTile } from "@/components/dashboard/stat-tile";
import { DataTable } from "@/components/data-table/data-table";
import {
  formatNumber,
  formatPercent,
  monthAxis,
  monthTooltipLabel,
  numberLocale,
} from "@/lib/dashboard/format";
import { useSpeciesName } from "@/lib/dashboard/species";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

// Light to dark with rising vulnerability (an ordinal ramp); grey for catch with no score.
const BAND_COLORS: Record<string, string> = {
  low: "var(--concern-1)",
  moderate: "var(--concern-2)",
  high: "var(--concern-3)",
  very_high: "var(--concern-4)",
  unknown: "var(--context-muted)",
};
const BANDS = [...VULNERABILITY_BANDS, "unknown"] as const;
const THREATENED = new Set(["VU", "EN", "CR"]);
const TOP_N = 25;

type Traits = RouterOutputs["summaries"]["speciesTraits"];

/** The one query behind the page: recorded catch by the FishBase traits of each taxon. */
function useSpeciesTraits() {
  const scope = useDistrictScope();
  return api.summaries.speciesTraits.useQuery(scope.input, scope.options);
}

/** The page's answers over the window: how much of the catch is highly vulnerable, sharks and rays, threatened groups. */
export function VulnerabilityTiles() {
  const { t, lang } = useT();
  const { data } = useSpeciesTraits();
  if (!data?.traitsAvailable) return null;

  const threatened = data.species.filter((s) =>
    (s.n_species ?? 0) > 1 ? (s.n_threatened ?? 0) > 0 : THREATENED.has(s.iucn_code ?? ""),
  ).length;
  const tiles = [
    {
      id: "vulnerable-high",
      label: t("tile-vulnerable-high"),
      value: formatPercent(data.window.high, lang),
      info: "info-vulnerability",
    },
    {
      id: "vulnerable-sharks",
      label: t("text-sharks-rays"),
      value: formatPercent(data.window.sharks_rays, lang),
      info: "info-sharks",
    },
    {
      id: "vulnerable-threatened",
      label: t("tile-threatened"),
      value: threatened.toLocaleString(numberLocale(lang)),
      unit: t("text-of-groups", { total: data.species.length }),
      info: "info-status",
    },
    {
      id: "vulnerable-coverage",
      label: t("tile-scored"),
      value: formatPercent(data.coverage, lang),
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.id}>
          <CardContent>
            <StatTile {...tile} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Share of the recorded catch in each vulnerability band, month by month. */
export function VulnerabilityBands() {
  const { t, lang } = useT();
  const query = useSpeciesTraits();
  const rows = query.data?.months ?? [];
  const label = (band: string) => t(`text-vulnerability-${band}`);

  return (
    <ChartCard
      id="vulnerability-bands"
      title={t("title-vulnerability-bands")}
      description={t("text-vulnerability-bands-description")}
      info="info-vulnerability"
      download={rows}
    >
      <ChartGate
        query={query}
        isEmpty={!rows.length || !query.data?.traitsAvailable}
        emptyDescription={t(
          query.data?.traitsAvailable === false
            ? "text-traits-not-published"
            : "text-no-data-available-for-filters",
        )}
      >
        <ChartContainer
          config={Object.fromEntries(BANDS.map((b) => [b, { label: label(b) }]))}
          className={`aspect-auto w-full ${CHART_HEIGHT}`}
        >
          <BarChart accessibilityLayer data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis {...monthAxis(lang)} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              allowDataOverflow
              tickFormatter={(v: number) => `${v}%`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={monthTooltipLabel(lang)}
                  formatter={(value, name, item) => (
                    <TooltipRow
                      color={item.color}
                      label={label(String(name))}
                      value={formatPercent(Number(value), lang)}
                    />
                  )}
                />
              }
            />
            {/* The bands in their order, low to very high; Recharts would sort them by name. */}
            <ChartLegend
              content={<ChartLegendContent />}
              itemSorter={(item) => BANDS.indexOf(item.dataKey as (typeof BANDS)[number])}
            />
            {BANDS.map((b) => (
              <Bar
                key={b}
                dataKey={b}
                stackId="bands"
                fill={BAND_COLORS[b]}
                stroke="var(--card)"
                strokeWidth={1}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </ChartGate>
    </ChartCard>
  );
}

/** Share of the recorded catch that is sharks and rays, month by month. */
export function SharksAndRays() {
  const { t, lang } = useT();
  const query = useSpeciesTraits();
  const rows = (query.data?.months ?? []).map((m) => ({
    month: m.month,
    sharks_rays: m.sharks_rays ?? 0,
    catch_kg: m.catch_kg,
  }));
  const any = rows.some((r) => r.sharks_rays > 0);

  return (
    <ChartCard
      id="sharks-rays"
      title={t("title-sharks-rays")}
      description={t("text-sharks-rays-description")}
      info="info-sharks"
      download={rows}
    >
      <ChartGate
        query={query}
        isEmpty={!any}
        emptyDescription={t(
          query.data?.traitsAvailable === false
            ? "text-traits-not-published"
            : "text-no-sharks-rays",
        )}
      >
        <ChartContainer
          config={{ sharks_rays: { label: t("text-sharks-rays") } }}
          className={`aspect-auto w-full ${CHART_HEIGHT}`}
        >
          <BarChart accessibilityLayer data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis {...monthAxis(lang)} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width="auto"
              niceTicks="snap125"
              tickFormatter={(v: number) => formatPercent(v, lang)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideIndicator
                  labelFormatter={monthTooltipLabel(lang)}
                  formatter={(value, _name, item) => (
                    <div className="grid w-full gap-1">
                      <TooltipRow
                        label={t("text-sharks-rays")}
                        value={formatPercent(Number(value), lang)}
                      />
                      <TooltipRow
                        label={t("text-recorded-catch-month")}
                        value={`${formatNumber(item.payload.catch_kg, lang)} kg`}
                      />
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey="sharks_rays"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ChartContainer>
      </ChartGate>
    </ChartCard>
  );
}

type SpeciesRow = Traits["species"][number];

/** A group of species (a genus, a family) with a spread of vulnerability scores. */
const isGroup = (s: SpeciesRow) =>
  (s.n_species ?? 0) > 1 && s.vulnerability_min != null && s.vulnerability_max != null;
/** A group's median score as the bar, its species' range as a light band behind it. */
const VULNERABILITY_FILL = {
  score: "var(--concern-3)",
  range: "color-mix(in oklab, var(--concern-1) 40%, transparent)",
};
const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, SpeciesRow>();
const right = (node: React.ReactNode) => (
  <span className="block text-right tabular-nums">{node}</span>
);

/** The most-landed taxa with their vulnerability, conservation status and trophic level. */
export function SpeciesStatusTable() {
  const { t, lang } = useT();
  const query = useSpeciesTraits();
  const name = useSpeciesName();
  // Without traits the table would list species with every status column empty.
  const species = useMemo(
    () => (query.data?.traitsAvailable ? query.data.species.slice(0, TOP_N) : []),
    [query.data],
  );
  const hasCites = species.some((s) => (s.n_cites ?? 0) > 0);
  const hasGroups = species.some(isGroup);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("taxon", {
          header: t("text-species"),
          cell: ({ row }) => {
            const taxon = row.original.taxon;
            return (
              <>
                <div className="font-medium">{name(taxon) || t("text-unknown")}</div>
                {taxon && name(taxon) !== taxon && (
                  <div className="text-xs text-muted-foreground italic">{taxon}</div>
                )}
              </>
            );
          },
        }),
        columnHelper.accessor("share", {
          header: () => right(t("text-share-of-recorded-catch")),
          cell: ({ getValue }) => right(formatPercent(getValue(), lang)),
        }),
        columnHelper.accessor("vulnerability", {
          header: t("text-vulnerability"),
          cell: ({ row }) => {
            const s = row.original;
            if (s.vulnerability == null) return <span className="text-muted-foreground">–</span>;
            const group = isGroup(s);
            return (
              <span
                className="flex items-center gap-2"
                title={group ? `${s.vulnerability_min}–${s.vulnerability_max}` : undefined}
              >
                <span className="w-7 text-right tabular-nums">{Math.round(s.vulnerability)}</span>
                <span className="relative h-2 w-24 rounded-sm bg-muted">
                  {group && (
                    <span
                      className="absolute inset-y-0 rounded-sm"
                      style={{
                        left: `${s.vulnerability_min}%`,
                        width: `${Math.max(1, s.vulnerability_max! - s.vulnerability_min!)}%`,
                        backgroundColor: VULNERABILITY_FILL.range,
                      }}
                    />
                  )}
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${s.vulnerability}%`,
                      backgroundColor: VULNERABILITY_FILL.score,
                    }}
                  />
                </span>
              </span>
            );
          },
        }),
        columnHelper.accessor("iucn_code", {
          header: t("text-iucn"),
          cell: ({ row }) => {
            const s = row.original;
            if ((s.n_species ?? 0) > 1) {
              return s.n_threatened != null
                ? t("text-threatened-of", { count: s.n_threatened, total: s.n_species })
                : "–";
            }
            if (!s.iucn_code) return "–";
            const code = s.iucn_code.replace(/\W/g, "");
            return (
              <span className="flex items-center gap-2">
                <Badge variant={THREATENED.has(code) ? "default" : "outline"}>{code}</Badge>
                <span className="text-muted-foreground">
                  {t(`iucn-${code}`, { defaultValue: s.iucn_code })}
                </span>
              </span>
            );
          },
        }),
        ...(hasCites
          ? [
              columnHelper.accessor("n_cites", {
                header: () => right(t("text-cites")),
                cell: ({ getValue }) =>
                  right(getValue() ? t("text-cites-listed", { count: getValue()! }) : "–"),
              }),
            ]
          : []),
        columnHelper.accessor("trophic_level", {
          header: () => right(t("text-trophic-level")),
          cell: ({ getValue }) =>
            right(
              getValue() == null
                ? "–"
                : getValue()!.toLocaleString(numberLocale(lang), { maximumFractionDigits: 1 }),
            ),
        }),
      ]),
    [t, lang, name, hasCites],
  );
  const table = useTable({ features, data: species, columns });

  return (
    <ChartCard
      id="species-status"
      title={t("title-species-status")}
      description={t("text-species-status-description", { count: TOP_N })}
      info="info-status"
      download={query.data?.traitsAvailable ? query.data.species : undefined}
      footer={
        hasGroups && (
          <Legend
            items={[
              { label: t("text-vulnerability-score"), color: VULNERABILITY_FILL.score },
              { label: t("text-vulnerability-range"), color: VULNERABILITY_FILL.range },
            ]}
          />
        )
      }
    >
      <ChartGate
        query={query}
        isEmpty={!species.length}
        emptyDescription={t(
          query.data?.traitsAvailable === false
            ? "text-traits-not-published"
            : "text-no-data-available-for-filters",
        )}
        className="h-64"
      >
        <DataTable table={table} />
      </ChartGate>
    </ChartCard>
  );
}
