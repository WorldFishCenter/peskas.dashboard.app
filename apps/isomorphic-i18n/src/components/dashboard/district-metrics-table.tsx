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
import { Badge } from "@workspace/ui/components/badge";
import { useT } from "@/i18n/use-lang";
import { sortNullsAsZero } from "@/components/charts/heat-cell";
import { WarningIcon } from "@/components/charts/warning-icon";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { formatNumber } from "@/lib/dashboard/format";
import type { RouterOutputs } from "@isomorphic/api";
import { confidenceBand, FEW_LANDINGS, type MetricKey } from "@repo/domain/metrics";
import { metricTitle, metricUnit } from "@/lib/dashboard/metrics";

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

type DistrictRow = RouterOutputs["summaries"]["byDistrict"][number];

const columnHelper = createColumnHelper<typeof features, DistrictRow>();

/** A district whose figures rest on fewer than FEW_LANDINGS landings. */
const isFew = (row: DistrictRow) => (row.n_submissions ?? 0) < FEW_LANDINGS;

// Column order: landings and trips first, then what a trip brings, rates, prices and the estimates.
const TABLE_METRICS: MetricKey[] = [
  "n_submissions",
  "n_fishers",
  "trip_duration_hrs",
  "mean_catch_kg",
  "mean_catch_price",
  "mean_cpue",
  "mean_rpue",
  "mean_price_kg",
  "estimated_fishing_trips",
  "estimated_catch_tn",
  "estimated_revenue",
];

// Counts have no unit in the metric strings, so the table spells them out.
const UNIT_KEY_OVERRIDES: Record<string, string> = {
  n_submissions: "text-unit-submissions",
  n_fishers: "text-unit-fishers",
};

const right = (node: React.ReactNode) => (
  <span className="block text-right tabular-nums">{node}</span>
);

/** Every measure for every surveyed district, sortable; numbers to read, not colours. */
export function DistrictMetricsTable({ rows }: { rows: DistrictRow[] }) {
  const { t, lang } = useT();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => {
    const numeric = (v: unknown) => (typeof v === "number" && !isNaN(v) ? v : null);
    // A measure no district has in this window (or this database) gets no column.
    const withData = TABLE_METRICS.filter((key) => rows.some((r) => numeric(r[key]) !== null));
    const hasConfidence = rows.some((r) => r.sampling_rate != null);

    return columnHelper.columns([
      columnHelper.accessor("district", {
        header: ({ column }) => (
          <SortableHeader column={column}>{t("text-district")}</SortableHeader>
        ),
        sortFn: "alphanumeric",
        sortDescFirst: false,
        cell: ({ getValue, row }) => {
          const few = isFew(row.original);
          return (
            <span
              className="flex items-center gap-1 font-medium"
              title={few ? t("text-scope-few-landings") : undefined}
            >
              {getValue()}
              {few && <WarningIcon label={t("text-scope-few-landings")} />}
            </span>
          );
        },
      }),
      ...withData.map((key) =>
        columnHelper.accessor((row) => row[key], {
          id: key,
          header: ({ column }) => {
            const unit = UNIT_KEY_OVERRIDES[key] ? t(UNIT_KEY_OVERRIDES[key]) : metricUnit(t, key);
            return (
              <SortableHeader column={column}>
                {metricTitle(t, key)}
                {unit && <span className="font-normal text-muted-foreground">({unit})</span>}
              </SortableHeader>
            );
          },
          sortFn: sortNullsAsZero,
          sortDescFirst: true,
          cell: ({ getValue }) => right(formatNumber(numeric(getValue()), lang)),
        }),
      ),
      ...(hasConfidence
        ? [
            columnHelper.accessor("sampling_rate", {
              header: ({ column }) => (
                <SortableHeader column={column}>{t("text-confidence")}</SortableHeader>
              ),
              sortFn: sortNullsAsZero,
              sortDescFirst: true,
              cell: ({ getValue }) => {
                const band = confidenceBand(getValue());
                return band ? (
                  <Badge
                    variant={band === "low" ? "outline" : "secondary"}
                    title={t("text-confidence-tracked", { pct: Math.round(getValue()! * 100) })}
                  >
                    {t(`text-confidence-${band}`)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                );
              },
            }),
          ]
        : []),
    ]);
  }, [rows, t, lang]);

  const table = useTable({
    features,
    data: rows,
    columns,
    // Headers only ever toggle between ascending and descending.
    enableSortingRemoval: false,
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <DataTable
      table={table}
      rowClassName={(row) => (isFew(row) ? "text-muted-foreground" : undefined)}
    />
  );
}
