import { useMemo } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { WarningIcon } from "@/components/charts/warning-icon";
import { HeatCell, valueRange } from "@/components/charts/heat-cell";
import { DataTable } from "@/components/data-table/data-table";
import { activeCountry } from "@/config/countryConfig";
import { calendarMonthLabel } from "@/lib/dashboard/format";
import { api } from "@/trpc/react";

/** The window the matrix covers; the About page reads the same query for its update date. */
export const COVERAGE_MONTHS = 24;

const features = tableFeatures({});
type DistrictRow = { district: string } & Record<string, number | string | null>;
const columnHelper = createColumnHelper<typeof features, DistrictRow>();

/** Landings surveyed per district and month over the last two years: where the data is thick or thin. */
export function CoverageMatrix() {
  const { t, lang } = useT();
  const query = api.summaries.coverage.useQuery({ months: COVERAGE_MONTHS });

  const { months, rows } = useMemo(() => {
    const cells = query.data?.cells ?? [];
    const months = [...new Set(cells.map((c) => c.month))].sort();
    const landings = new Map(cells.map((c) => [`${c.district}|${c.month}`, c.landings]));
    const rows = [...activeCountry.districts].sort().map(
      (district): DistrictRow => ({
        district,
        ...Object.fromEntries(months.map((m) => [m, landings.get(`${district}|${m}`) ?? null])),
      }),
    );
    return { months, rows };
  }, [query.data]);

  const columns = useMemo(() => {
    const range = valueRange((query.data?.cells ?? []).map((c) => c.landings));
    return columnHelper.columns([
      columnHelper.accessor("district", {
        header: t("text-district"),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      ...months.map((m) =>
        columnHelper.accessor((row) => (row[m] as number | null) ?? null, {
          id: m,
          // Month over year, two short lines: 24 columns fit a laptop screen.
          header: () => (
            <span className="block text-center text-xs leading-tight">
              {calendarMonthLabel(Number(m.slice(5)), lang)}
              <span className="block text-muted-foreground">{m.slice(2, 4)}</span>
            </span>
          ),
          cell: ({ getValue }) => (
            <span className="block text-center">
              <HeatCell
                dense
                value={getValue()}
                {...range}
                label={getValue()?.toLocaleString(lang) ?? "-"}
              />
            </span>
          ),
        }),
      ),
    ]);
  }, [months, query.data, lang, t]);

  const table = useTable({ features, data: rows, columns });

  return (
    <ChartCard
      id="coverage"
      title={t("title-coverage")}
      description={t("text-coverage-description", { count: COVERAGE_MONTHS })}
      info="info-coverage"
      download={query.data?.cells}
      footer={
        !!query.data?.unlisted.length && (
          <span className="flex items-center gap-1">
            <WarningIcon />
            {t("text-unlisted-districts", {
              districts: query.data.unlisted.join(", "),
              count: query.data.unlisted.length,
            })}
          </span>
        )
      }
    >
      <ChartGate query={query} isEmpty={!months.length} className="h-40">
        <DataTable table={table} />
      </ChartGate>
    </ChartCard>
  );
}
