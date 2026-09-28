import { useMemo } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { HeatCell, valueRange } from "@/components/charts/heat-cell";
import { WarningIcon } from "@/components/charts/warning-icon";
import { DataTable } from "@/components/data-table/data-table";
import type { MetricKey } from "@repo/domain/metrics";
import { calendarMonthLabel, formatNumber } from "@/lib/dashboard/format";
import { metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

/** A seasonal pattern needs each calendar month seen at least twice. */
const MIN_MONTHS = 24;

const features = tableFeatures({});
type DistrictRow = { district: string } & Record<number, number | null>;
const columnHelper = createColumnHelper<typeof features, DistrictRow>();

/**
 * Month-of-year pattern per selected district, over every year of data (the
 * time range doesn't apply). Under two years of data most calendar months
 * have been seen once, so it shows a line saying so instead of the table.
 */
export function SeasonalityHeatmap({
  metric,
  className,
}: {
  metric: MetricKey;
  className?: string;
}) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const { districts } = scope.input;
  const query = api.summaries.seasonality.useQuery({ districts, metric }, scope.options);
  const months = query.data?.months ?? 0;

  // One row per district with data, one column per calendar month.
  const rows = useMemo<DistrictRow[]>(() => {
    const byMonth = query.data?.rows ?? [];
    return districts
      .filter((d) => byMonth.some((r) => r[d] != null))
      .map((district) => ({
        district,
        ...Object.fromEntries(byMonth.map((r) => [r.month, r[district] ?? null])),
      }));
  }, [query.data, districts]);

  const columns = useMemo(() => {
    const range = valueRange(
      rows
        .flatMap((r) => Array.from({ length: 12 }, (_, i) => r[i + 1]))
        .filter((v): v is number => v != null),
    );
    return columnHelper.columns([
      columnHelper.accessor("district", {
        header: t("text-district"),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      ...Array.from({ length: 12 }, (_, i) =>
        columnHelper.accessor((row) => row[i + 1] ?? null, {
          id: String(i + 1),
          header: () => (
            <span className="block text-center">{calendarMonthLabel(i + 1, lang)}</span>
          ),
          cell: ({ getValue }) => (
            <span className="block text-center">
              <HeatCell value={getValue()} {...range} label={formatNumber(getValue(), lang)} />
            </span>
          ),
        }),
      ),
    ]);
  }, [rows, lang, t]);

  const table = useTable({ features, data: rows, columns });
  const unit = metricUnit(t, metric);

  // Under two years most calendar months have been seen once: that is a year, not a season.
  if (query.isPending) return null;
  if (query.data && months < MIN_MONTHS) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <WarningIcon />
        {t("text-seasonality-needs", { count: months, min: MIN_MONTHS })}
      </p>
    );
  }

  return (
    <ChartCard
      id={`seasonality-${metric}`}
      className={className}
      title={t("title-seasonality", { metric: metricTitle(t, metric) })}
      description={`${t("text-seasonality-description")}${unit ? ` (${unit})` : ""}`}
      info="info-seasonality"
      download={rows}
      footer={t("text-seasonality-footer", { count: months })}
    >
      <ChartGate query={query} isEmpty={!rows.length} className="h-40">
        <DataTable table={table} />
      </ChartGate>
    </ChartCard>
  );
}
