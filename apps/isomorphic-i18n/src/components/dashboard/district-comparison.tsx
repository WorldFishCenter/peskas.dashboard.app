import { useState } from "react";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/utils";
import type { RouterOutputs } from "@isomorphic/api";
import { FEW_LANDINGS, type MetricKey } from "@repo/domain/metrics";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { BarCell } from "@/components/charts/inline-bars";
import { WarningIcon } from "@/components/charts/warning-icon";
import { DistrictMetricsTable } from "@/components/dashboard/district-metrics-table";
import { GridMap } from "@/components/dashboard/grid-map";
import { Change } from "@/components/dashboard/stat-tile";
import { CHOSEN } from "@/components/filters/toggle-states";
import { activeCountry } from "@/config/countryConfig";
import { pages } from "@/config/routes";
import { useScopedHref, useT } from "@/i18n/use-lang";
import { trackEvent } from "@/lib/analytics";
import { formatNumber, numberLocale } from "@/lib/dashboard/format";
import {
  isLowConfidenceEstimate,
  metricTitle,
  metricUnit,
  yearChange,
} from "@/lib/dashboard/metrics";
import { regionLabel } from "@/lib/dashboard/regions";
import { usePageMetric, useScope } from "@/store/filters";
import { api } from "@/trpc/react";

type DistrictRow = RouterOutputs["summaries"]["byDistrict"][number];
type View = "ranking" | "map" | "all";

const surveyed = (row: DistrictRow) => (row.n_submissions ?? 0) > 0;
const isThin = (row: DistrictRow) => (row.n_submissions ?? 0) < FEW_LANDINGS;

/**
 * Every district side by side over the time range: ranked by one measure with
 * its change on a year earlier, on the map, or every measure in a table.
 * Districts with no landings are named once below instead of filling rows with dashes.
 */
export function DistrictComparison() {
  const { t } = useT();
  const { months } = useScope();
  const [metric, setMetric] = usePageMetric(pages.home.metric);
  const [view, setView] = useState<View>("ranking");
  const query = api.summaries.byDistrict.useQuery({ months });
  const rows = (query.data ?? []).filter(surveyed);
  const missing = (query.data ?? []).filter((r) => !surveyed(r)).map((r) => r.district);

  return (
    <ChartCard
      id="district-comparison"
      title={t("title-district-compare")}
      description={t("text-district-compare-description")}
      info="info-district-table"
      download={query.data?.map(({ previous: _previous, ...row }) => row)}
      footer={missing.length > 0 && t("text-no-landings-in", { districts: missing.join(", ") })}
    >
      <Tabs value={view} onValueChange={(v) => setView(v as View)} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          {view === "all" ? (
            <span />
          ) : (
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              aria-label={t("text-metric")}
              value={[metric]}
              onValueChange={(value) => {
                const next = value[0] as MetricKey | undefined;
                if (!next || next === metric) return;
                trackEvent("filter_metric_change", {
                  metric: next,
                  control_source: "district_widget",
                });
                setMetric(next);
              }}
            >
              {pages.home.metric.options.map((key) => (
                <ToggleGroupItem key={key} value={key} className={CHOSEN}>
                  {metricTitle(t, key)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <TabsList>
            <TabsTrigger value="ranking">{t("text-view-ranking")}</TabsTrigger>
            <TabsTrigger value="map">{t("text-view-map")}</TabsTrigger>
            <TabsTrigger value="all">{t("text-view-all")}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="ranking">
          <ChartGate
            query={query}
            isEmpty={!rows.length}
            emptyDescription={t("text-no-data-available")}
          >
            <Ranking rows={rows} metric={metric} />
          </ChartGate>
        </TabsContent>
        <TabsContent value="map">
          <GridMap mode="districts" className="h-[480px]" />
        </TabsContent>
        <TabsContent value="all">
          <ChartGate
            query={query}
            isEmpty={!rows.length}
            emptyDescription={t("text-no-data-available")}
          >
            <DistrictMetricsTable rows={rows} />
          </ChartGate>
        </TabsContent>
      </Tabs>
    </ChartCard>
  );
}

/** Districts in order of one measure, with a bar for its size and its change on a year earlier. */
function Ranking({ rows, metric }: { rows: DistrictRow[]; metric: MetricKey }) {
  const { t, lang } = useT();
  const scoped = useScopedHref();
  const unit = metricUnit(t, metric);
  const ranked = rows
    .filter((r) => r[metric] != null)
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
  const max = Math.max(...ranked.map((r) => r[metric] ?? 0), 0);
  // A change needs enough landings on both sides, and no low-confidence estimate shows one.
  const changeOf = (row: DistrictRow) => {
    if (isThin(row) || !row.previous || (row.previous.n_submissions ?? 0) < FEW_LANDINGS)
      return null;
    if (isLowConfidenceEstimate(metric, row.sampling_rate)) return null;
    return yearChange(row[metric], row.previous[metric]);
  };
  const showChange = ranked.some((r) => changeOf(r) != null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("text-district")}</TableHead>
          <TableHead>{t("text-region")}</TableHead>
          <TableHead className="w-[40%]">
            {metricTitle(t, metric)}
            {unit && <span className="font-normal text-muted-foreground"> ({unit})</span>}
          </TableHead>
          {showChange && <TableHead className="text-right">{t("text-vs-year-earlier")}</TableHead>}
          <TableHead className="text-right">{t("metric-n_submissions-title")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ranked.map((row) => {
          const thin = isThin(row);
          const change = changeOf(row);
          return (
            <TableRow key={row.district} className={cn(thin && "text-muted-foreground")}>
              <TableCell>
                <Link
                  to={scoped(pages.catch.path, { d: row.district })}
                  className="link font-medium"
                  title={t("text-open-district", { district: row.district })}
                >
                  {row.district}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {regionLabel(t, activeCountry.districtToRegion[row.district])}
              </TableCell>
              <TableCell>
                <BarCell
                  value={row[metric]}
                  max={max}
                  label={formatNumber(row[metric], lang)}
                  faded={thin}
                />
              </TableCell>
              {showChange && (
                <TableCell className="text-right">
                  {change != null ? <Change pct={change} /> : "–"}
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">
                <span className="inline-flex items-center gap-1">
                  {thin && <WarningIcon label={t("text-scope-few-landings")} />}
                  {(row.n_submissions ?? 0).toLocaleString(numberLocale(lang))}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
