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
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { useT } from "@/i18n/use-lang";
import { HeatCell, sortNullsAsZero, valueRange } from "@/components/charts/heat-cell";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { formatDashboardNumber } from "@/lib/dashboard/format";
import { metricTitle, metricUnit, type MetricKey } from "@/lib/dashboard/metrics";
import { dateRangeAtom } from "@/store/time-range";
import { api } from "@/trpc/react";

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

type DistrictRow = { gaul_2_name: string } & Record<string, number | null | string>;

const columnHelper = createColumnHelper<typeof features, DistrictRow>();

// Column order: counts and effort first, then rates, prices and totals.
const TABLE_METRICS: MetricKey[] = [
  "n_submissions",
  "n_fishers",
  "trip_duration_hrs",
  "mean_cpue",
  "mean_rpue",
  "mean_price_kg",
  "estimated_revenue",
  "estimated_catch_tn",
];

// Counts have no unit in the metric strings, so the table spells them out.
const UNIT_KEY_OVERRIDES: Record<string, string> = {
  n_submissions: "text-unit-submissions",
  n_fishers: "text-unit-fishers",
};

export function DistrictMetricsTable() {
  const { t, lang } = useT();
  const { start, end } = useAtomValue(dateRangeAtom);
  const { data, isLoading } = api.districtSummary.getDistrictsSummaryByDateRange.useQuery({
    startDate: start,
    endDate: end,
  });
  const rows = useMemo(() => (data ?? []) as DistrictRow[], [data]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => {
    const numeric = (v: unknown) => (typeof v === "number" && !isNaN(v) ? v : null);
    const ranges = Object.fromEntries(
      TABLE_METRICS.map((key) => [key, valueRange(rows.map((r) => numeric(r[key])).filter((v): v is number => v !== null))])
    );

    return columnHelper.columns([
      columnHelper.accessor("gaul_2_name", {
        header: ({ column }) => <SortableHeader column={column}>{t("text-district")}</SortableHeader>,
        sortFn: "alphanumeric",
        sortDescFirst: false,
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      ...TABLE_METRICS.map((key) =>
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
          // Missing values sort as 0, as they always have.
          sortFn: sortNullsAsZero,
          sortDescFirst: false,
          cell: ({ getValue }) => {
            const value = numeric(getValue());
            return <HeatCell value={value} {...ranges[key]} label={formatDashboardNumber(value, key, lang)} />;
          },
        })
      ),
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
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("text-district-metrics")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {t("text-no-data-available")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
