import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { HeatCell, sortNullsAsZero, valueRange } from "@/components/charts/heat-cell";
import { districtsAtom } from "@/store/filters";
import { monthsAtom } from "@/store/time-range";
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

const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(1));

/** Catch (kg) of the top species in each selected district. */
export function DistrictSpeciesHeatmap({ className }: { className?: string }) {
  const { t } = useT();
  const districts = useAtomValue(districtsAtom);
  const months = useAtomValue(monthsAtom);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data, isLoading, error } = api.summaries.taxa.useQuery(
    { districts, metrics: ["catch_kg"], months },
    { enabled: districts.length > 0 }
  );

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

  const columns = useMemo(() => {
    // No catch counts as missing, both for the colour scale and the cell.
    const range = (key: string) => valueRange(rows.map((r) => Number(r[key])).filter((v) => v > 0));
    const totals = range("total");

    return columnHelper.columns([
      columnHelper.accessor("taxon", {
        header: ({ column }) => <SortableHeader column={column}>{t("text-species")}</SortableHeader>,
        sortFn: "alphanumeric",
        cell: ({ getValue }) => (
          <span title={getValue()} className="block max-w-48 truncate font-medium">
            {getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("total", {
        header: ({ column }) => <SortableHeader column={column}>{t("text-total")}</SortableHeader>,
        sortFn: sortNullsAsZero,
        cell: ({ getValue }) => (
          <HeatCell value={getValue()} {...totals} label={fmt(getValue())} title={`${fmt(getValue())} kg`} />
        ),
      }),
      ...districts.map((district) => {
        const { min, max } = range(district);
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
  }, [rows, districts, t]);

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
      className={className}
      title={t("text-district-species-breakdown")}
      description={t("text-district-species-description")}
    >
      <ChartGate isLoading={isLoading} error={error} isEmpty={!rows.length} className="h-64">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    <table.FlexRender header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartGate>
    </ChartCard>
  );
}
