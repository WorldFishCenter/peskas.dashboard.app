import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import { useMemo } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import type { RouterOutputs } from "@isomorphic/api";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_HEIGHT, ChartGate } from "@/components/charts/chart-state";
import { useSeriesToggle } from "@/components/charts/series-legend";
import { DataTable } from "@/components/data-table/data-table";
import { TooltipRow } from "@/components/charts/tooltip-row";
import { VULNERABILITY_BANDS } from "@repo/domain/metrics";
import { formatPercent, monthAxis, monthTooltipLabel } from "@/lib/dashboard/format";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

// Light to dark with rising vulnerability; grey for catch with no score.
const BAND_COLORS: Record<string, string> = {
  low: "#fed7aa",
  moderate: "#fb923c",
  high: "#c2410c",
  very_high: "#7c2d12",
  unknown: "#a8a29e",
};
const TOP_N = 25;

/** The one query behind the page: recorded catch by the FishBase traits of each taxon. */
function useSpeciesTraits() {
  const scope = useDistrictScope();
  return { scope, query: api.summaries.speciesTraits.useQuery(scope.input, scope.options) };
}

/** Share of the recorded catch in each vulnerability band, month by month. */
export function VulnerabilityBands() {
  const { t, lang } = useT();
  const { scope, query } = useSpeciesTraits();
  const rows = query.data?.months ?? [];
  const bands = [...VULNERABILITY_BANDS, "unknown"].map((b) => ({ key: b, label: t(`text-vulnerability-${b}`), color: BAND_COLORS[b] }));
  const { chartConfig, isHidden, legend } = useSeriesToggle(bands);
  const coverage = query.data?.traitsAvailable ? query.data.coverage : null;

  return (
    <ChartCard
      id="vulnerability-bands"
      title={t("title-vulnerability-bands")}
      description={
        coverage != null
          ? t("text-vulnerability-coverage", { share: formatPercent(coverage, lang) })
          : t("text-vulnerability-bands-description")
      }
      info="info-vulnerability"
      download={rows}
      scope={scope}
    >
      <ChartGate
        query={query}
        isEmpty={!rows.length || !query.data?.traitsAvailable}
        emptyDescription={t(query.data?.traitsAvailable === false ? "text-traits-not-published" : "text-no-data-available-for-filters")}
      >
        <>
          <ChartContainer config={chartConfig} className={`aspect-auto w-full ${CHART_HEIGHT}`}>
            <BarChart accessibilityLayer data={rows}>
              <CartesianGrid vertical={false} />
              <XAxis {...monthAxis(lang)} />
              <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 100]} allowDataOverflow tickFormatter={(v: number) => `${Math.round(v)}%`} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={monthTooltipLabel(lang)}
                    formatter={(value, name, item) => (
                      <TooltipRow
                        color={item.color}
                        label={chartConfig[String(name)]?.label ?? name}
                        value={formatPercent(Number(value), lang)}
                      />
                    )}
                  />
                }
              />
              {bands.map((b) => (
                <Bar key={b.key} dataKey={b.key} stackId="bands" fill={b.color} hide={isHidden(b.key)} />
              ))}
            </BarChart>
          </ChartContainer>
          {legend}
        </>
      </ChartGate>
    </ChartCard>
  );
}

/** Share of the recorded catch that is sharks and rays, month by month. */
export function SharksAndRays() {
  const { t, lang } = useT();
  const { scope, query } = useSpeciesTraits();
  const rows = (query.data?.months ?? []).map((m) => ({ month: m.month, sharks_rays: m.sharks_rays ?? 0 }));
  const any = rows.some((r) => r.sharks_rays > 0);

  return (
    <ChartCard
      id="sharks-rays"
      title={t("title-sharks-rays")}
      description={t("text-sharks-rays-description")}
      info="info-sharks"
      download={rows}
      scope={scope}
    >
      <ChartGate
        query={query}
        isEmpty={!any}
        emptyDescription={t(query.data?.traitsAvailable === false ? "text-traits-not-published" : "text-no-sharks-rays")}
      >
        <ChartContainer
          config={{ sharks_rays: { label: t("text-sharks-rays") } }}
          className={`aspect-auto w-full ${CHART_HEIGHT}`}
        >
          <BarChart accessibilityLayer data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis {...monthAxis(lang)} />
            <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${v}%`} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={monthTooltipLabel(lang)}
                  formatter={(value) => formatPercent(Number(value), lang)}
                />
              }
            />
            <Bar dataKey="sharks_rays" fill={BAND_COLORS.high} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartGate>
    </ChartCard>
  );
}

type SpeciesRow = RouterOutputs["summaries"]["speciesTraits"]["species"][number];
const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, SpeciesRow>();
const num = (v: number | null, lang: string, digits = 0) =>
  v == null ? "-" : v.toLocaleString(lang, { maximumFractionDigits: digits });
const right = (node: React.ReactNode) => <span className="block text-right tabular-nums">{node}</span>;

/** The most-landed taxa with their vulnerability, conservation status and trophic level. */
export function SpeciesStatusTable() {
  const { t, lang } = useT();
  const { scope, query } = useSpeciesTraits();
  // Without traits the table would list species with every status column empty.
  const species = useMemo(() => (query.data?.traitsAvailable ? query.data.species.slice(0, TOP_N) : []), [query.data]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("taxon", {
          header: t("text-species"),
          cell: ({ row }) => (
            <>
              <div className="font-medium">{row.original.taxon ?? t("text-unknown")}</div>
              {row.original.english_name && <div className="text-xs text-muted-foreground">{row.original.english_name}</div>}
            </>
          ),
        }),
        columnHelper.accessor("share", {
          header: () => right(t("text-share-of-recorded-catch")),
          cell: ({ getValue }) => right(formatPercent(getValue(), lang)),
        }),
        columnHelper.accessor("vulnerability", {
          header: () => right(t("text-vulnerability")),
          cell: ({ row }) => {
            const s = row.original;
            return right(
              <>
                {num(s.vulnerability, lang)}
                {(s.n_species ?? 0) > 1 && s.vulnerability_min != null && (
                  <div className="text-xs text-muted-foreground">
                    {num(s.vulnerability_min, lang)}–{num(s.vulnerability_max, lang)}
                  </div>
                )}
              </>
            );
          },
        }),
        columnHelper.accessor("iucn_code", {
          header: t("text-iucn"),
          cell: ({ row }) => {
            const s = row.original;
            if ((s.n_species ?? 0) > 1) {
              return s.n_threatened != null ? t("text-threatened-of", { count: s.n_threatened, total: s.n_species }) : "-";
            }
            return s.iucn_code ? t(`iucn-${s.iucn_code.replace(/\W/g, "")}`, { defaultValue: s.iucn_code }) : "-";
          },
        }),
        columnHelper.accessor("n_cites", {
          header: () => right(t("text-cites")),
          cell: ({ getValue }) => right(getValue() ? t("text-cites-listed", { count: getValue()! }) : "-"),
        }),
        columnHelper.accessor("trophic_level", {
          header: () => right(t("text-trophic-level")),
          cell: ({ getValue }) => right(num(getValue(), lang, 1)),
        }),
      ]),
    [t, lang]
  );
  const table = useTable({ features, data: species, columns });

  return (
    <ChartCard
      id="species-status"
      title={t("title-species-status")}
      description={t("text-species-status-description", { count: TOP_N })}
      info="info-status"
      download={query.data?.traitsAvailable ? query.data.species : undefined}
      scope={scope}
    >
      <ChartGate
        query={query}
        isEmpty={!species.length}
        emptyDescription={t(query.data?.traitsAvailable === false ? "text-traits-not-published" : "text-no-data-available-for-filters")}
        className="h-64"
      >
        <DataTable table={table} />
      </ChartGate>
    </ChartCard>
  );
}
