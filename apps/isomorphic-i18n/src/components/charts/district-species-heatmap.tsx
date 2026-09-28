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
import { formatNumber } from "@/lib/dashboard/format";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { HeatCell, sortNullsAsZero, valueRange } from "@/components/charts/heat-cell";
import { compositionInfo } from "@/lib/dashboard/metrics";
import { useSpeciesName } from "@/lib/dashboard/species";
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

/** Catch (kg) of the top species in each selected district. */
export function DistrictSpeciesHeatmap({ className }: { className?: string }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const { districts } = scope.input;
  const [sorting, setSorting] = useState<SortingState>([]);
  const name = useSpeciesName();

  const query = api.summaries.taxa.useQuery(
    { ...scope.input, metrics: ["catch_kg"] },
    scope.options,
  );
  const { data } = query;

  const rows = useMemo(() => {
    const bySpecies = new Map<string, Record<string, number>>();
    for (const row of data ?? []) {
      const kg = row.catch_kg ?? 0;
      if (kg <= 0) continue;
      const taxon = row.taxon ?? t("text-unknown");
      const entry = bySpecies.get(taxon) ?? {};
      entry[row.district] = (entry[row.district] ?? 0) + kg;
      bySpecies.set(taxon, entry);
    }
    return Array.from(bySpecies, ([taxon, values]) => ({
      taxon,
      total: Object.values(values).reduce((a, b) => a + b, 0),
      ...Object.fromEntries(districts.map((d) => [d, values[d] ?? 0])),
    }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_N) as HeatRow[];
  }, [data, districts, t]);

  // Districts with catch among these species; one colour scale for every cell, so a shade means the same weight anywhere.
  const shown = useMemo(
    () => districts.filter((d) => rows.some((r) => Number(r[d]) > 0)),
    [rows, districts],
  );
  const columns = useMemo(() => {
    const fmt = (v: number) => formatNumber(v, lang);
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
              title={`${district}: ${fmt(getValue())} kg`}
            />
          ),
        });
      }),
    ]);
  }, [rows, shown, t, name, lang]);

  const table = useTable({
    features,
    data: rows,
    columns,
    enableSortingRemoval: false,
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <ChartCard
      id="district-species"
      className={className}
      title={t("title-district-species")}
      description={t("text-district-species-description")}
      info={compositionInfo(t)}
      download={rows}
    >
      <ChartGate query={query} isEmpty={!rows.length} className="h-64">
        <DataTable table={table} />
      </ChartGate>
    </ChartCard>
  );
}
