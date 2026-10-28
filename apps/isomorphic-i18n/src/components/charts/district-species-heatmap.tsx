import { useMemo, useState } from "react";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { HeatCell, sortNullsAsZero, valueRange } from "@/components/charts/heat-cell";
import { CoverageBadge } from "@/components/dashboard/headline";
import { SwatchToggle } from "@/components/filters/swatch-toggle";
import { Linked } from "@/components/linked-text";
import { trackEvent } from "@/lib/analytics";
import {
  compositionInfo,
  formatValue,
  SPECIES_FIGURE,
  SPECIES_FIGURES,
  speciesEstimateInfo,
  type SpeciesFigure,
} from "@/lib/dashboard/metrics";
import { useSpeciesEstimates, useSpeciesName } from "@/lib/dashboard/species";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

const TOP_N = 15;

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

type HeatRow = { taxon: string; total: number } & Record<string, number | string>;
const columnHelper = createColumnHelper<typeof features, HeatRow>();

/**
 * Catch of the top species in each selected district: recorded (kg), or, once
 * the portal has them, estimated for all boats by FAO ARTFISH (tonnes), which
 * leaves out the districts it has no estimate for and says so.
 */
export function DistrictSpeciesHeatmap({ className }: { className?: string }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const { districts } = scope.input;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [picked, setPicked] = useState<SpeciesFigure>("recorded");
  const name = useSpeciesName();

  const query = api.summaries.taxa.useQuery(
    { ...scope.input, metrics: ["catch_kg", "estimated_catch_tn_fao"] },
    scope.options,
  );
  // The ranking's own: whether the portal has the estimates, and the district-months they cover.
  const estimates = useSpeciesEstimates();
  const shownFigure: SpeciesFigure = estimates.data?.available ? picked : "recorded";
  const figure = SPECIES_FIGURE[shownFigure];
  const { metric } = figure;
  const estimated = shownFigure === "artfish";
  const { data } = query;

  const rows = useMemo(() => {
    const bySpecies = new Map<string, Record<string, number>>();
    for (const row of data ?? []) {
      const value = row[metric] ?? 0;
      if (value <= 0) continue;
      const taxon = row.taxon ?? t("text-unknown");
      const entry = bySpecies.get(taxon) ?? {};
      entry[row.district] = (entry[row.district] ?? 0) + value;
      bySpecies.set(taxon, entry);
    }
    return Array.from(bySpecies, ([taxon, values]) => ({
      taxon,
      total: Object.values(values).reduce((a, b) => a + b, 0),
      ...Object.fromEntries(districts.map((d) => [d, values[d] ?? 0])),
    }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_N) as HeatRow[];
  }, [data, districts, metric, t]);

  // Districts with catch among these species; one colour scale for every cell, so a shade means the same weight anywhere.
  const shown = useMemo(
    () => districts.filter((d) => rows.some((r) => Number(r[d]) > 0)),
    [rows, districts],
  );
  const columns = useMemo(() => {
    const fmt = (v: number) => formatValue(figure.metric, v, lang);
    const unit = figure.unit(t);
    const range = valueRange(
      rows.flatMap((r) => shown.map((d) => Number(r[d]))).filter((v) => v > 0),
    );

    return columnHelper.columns([
      columnHelper.accessor("taxon", {
        header: ({ column }) => (
          <SortableHeader column={column}>{t("text-species")}</SortableHeader>
        ),
        sortFn: "alphanumeric",
        cell: ({ getValue }) => (
          <span title={getValue()} className="flex max-w-56 flex-col">
            <span className="truncate font-medium">{name(getValue())}</span>
            {name(getValue()) !== getValue() && (
              <span className="truncate text-xs text-muted-foreground italic">{getValue()}</span>
            )}
          </span>
        ),
      }),
      columnHelper.accessor("total", {
        header: ({ column }) => <SortableHeader column={column}>{t("text-total")}</SortableHeader>,
        sortFn: sortNullsAsZero,
        cell: ({ getValue }) => (
          <span className="block text-right font-medium tabular-nums">{fmt(getValue())}</span>
        ),
      }),
      ...shown.map((district) => {
        const { min, max } = range;
        return columnHelper.accessor((row) => Number(row[district]) || 0, {
          id: district,
          header: ({ column }) => <SortableHeader column={column}>{district}</SortableHeader>,
          sortFn: sortNullsAsZero,
          cell: ({ getValue }) => (
            <HeatCell
              value={getValue() > 0 ? getValue() : null}
              min={min}
              max={max}
              label={fmt(getValue())}
              title={`${district}: ${fmt(getValue())} ${unit}`}
              method={figure.method}
            />
          ),
        });
      }),
    ]);
  }, [rows, shown, t, name, lang, figure]);

  const table = useTable({
    features,
    data: rows,
    columns,
    enableSortingRemoval: false,
    onSortingChange: setSorting,
    state: { sorting },
  });

  // What the estimates leave out: districts with none in the window.
  const leftOut = useMemo(() => {
    const estimatedIn = new Set(
      (data ?? []).filter((r) => (r.estimated_catch_tn_fao ?? 0) > 0).map((r) => r.district),
    );
    return districts.filter((d) => !estimatedIn.has(d)).length;
  }, [data, districts]);
  // The card's own words for the figure shown: its id, description, explanation, empty state and footer.
  const card = estimated
    ? {
        id: "district-species-estimate",
        description: t("text-district-species-estimate-description"),
        info: speciesEstimateInfo(t),
        empty: t("text-species-estimate-none"),
        footer: (
          <>
            {estimates.coverage && (
              <div>
                <CoverageBadge coverage={estimates.coverage} single={districts.length === 1} />
              </div>
            )}
            {leftOut > 0 && (
              <p>
                <Linked
                  text={t("text-district-species-estimate-left-out", {
                    count: leftOut,
                    total: districts.length,
                  })}
                />
              </p>
            )}
            <p>
              <Linked text={t("text-district-species-estimate-dash")} />
            </p>
          </>
        ),
      }
    : {
        id: "district-species",
        description: t("text-district-species-description"),
        info: compositionInfo(t),
        empty: undefined,
        footer: estimates.failed && (
          <p>
            <Linked text={t("text-species-estimate-failed")} />
          </p>
        ),
      };

  return (
    <ChartCard
      id={card.id}
      className={className}
      title={t("title-district-species")}
      description={card.description}
      action={
        estimates.data?.available && (
          <SwatchToggle
            label={t("text-species-measure")}
            value={shownFigure}
            options={SPECIES_FIGURES.map((f) => ({
              value: f,
              label: t(SPECIES_FIGURE[f].label),
              color: SPECIES_FIGURE[f].color,
            }))}
            onChange={(f) => {
              trackEvent("filter_metric_change", {
                metric: SPECIES_FIGURE[f].metric,
                control_source: "district_species",
              });
              setPicked(f);
              setSorting([]);
            }}
          />
        )
      }
      info={card.info}
      download={rows}
      footer={rows.length > 0 && card.footer}
    >
      <ChartGate
        query={query}
        isEmpty={!rows.length}
        emptyDescription={card.empty}
        className="h-64"
      >
        <DataTable table={table} />
      </ChartGate>
    </ChartCard>
  );
}
