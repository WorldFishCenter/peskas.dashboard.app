import { Fragment, useState } from "react";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/utils";
import type { RouterOutputs } from "@isomorphic/api";
import {
  changeHidden,
  FEW_LANDINGS,
  methodKeys,
  type Method,
  type MetricKey,
} from "@repo/domain/metrics";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { Bar } from "@/components/charts/inline-bars";
import { Legend } from "@/components/charts/legend";
import { WarningIcon } from "@/components/charts/warning-icon";
import { DistrictMetricsTable } from "@/components/dashboard/district-metrics-table";
import { GridMap } from "@/components/dashboard/grid-map";
import { Change } from "@/components/dashboard/stat-tile";
import { MethodToggle } from "@/components/filters/method-toggle";
import { CHOSEN } from "@/components/filters/toggle-states";
import { activeCountry } from "@/config/countryConfig";
import { pages } from "@/config/routes";
import { useScopedHref, useT } from "@/i18n/use-lang";
import { trackEvent } from "@/lib/analytics";
import { numberLocale } from "@/lib/dashboard/format";
import {
  byFigures,
  formatValue,
  METHOD_COLOR,
  methodsWithData,
  methodTitle,
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
  // The map shows one method at a time; the ranking and the table show both.
  const [method, setMethod] = useState<Method>("tracker");
  const query = api.summaries.byDistrict.useQuery({ months });
  const rows = (query.data ?? []).filter(surveyed);
  const missing = (query.data ?? []).filter((r) => !surveyed(r)).map((r) => r.district);
  const methods = methodsWithData(metric, rows);
  const bothMethods = methods.length === 2;

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
            // A phone can't fit every measure: the row scrolls sideways, as in shadcn's horizontal ScrollArea.
            <ScrollArea className="max-w-full min-w-0 whitespace-nowrap">
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                className="w-max pb-3 lg:pb-0"
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
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
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
            <Ranking rows={rows} metric={metric} methods={methods} />
          </ChartGate>
        </TabsContent>
        <TabsContent value="map" className="flex flex-col gap-3">
          {bothMethods && (
            <MethodToggle value={method} onChange={setMethod} source="district_map" />
          )}
          <GridMap
            mode="districts"
            method={bothMethods ? method : "tracker"}
            className="h-[480px]"
          />
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

/**
 * Districts in order of one measure, with a bar for its size and its change on
 * a year earlier. An estimate both methods make gets a bar column per method
 * with data, in its colour on one scale and keyed below, the change beside the
 * GPS tracker column (ARTFISH has none), and keeps the districts only one
 * method estimates, after the others.
 */
function Ranking({
  rows,
  metric,
  methods,
}: {
  rows: DistrictRow[];
  metric: MetricKey;
  /** The methods with data, for an estimate both methods make. */
  methods: Method[];
}) {
  const { t, lang } = useT();
  const scoped = useScopedHref();
  const unit = metricUnit(t, metric);
  const keys = methodKeys(metric);
  // A recorded figure has no method: its bar takes the single-series colour.
  const columns: { key: MetricKey; method?: Method }[] = keys
    ? methods.map((method) => ({ key: keys[method], method }))
    : [{ key: metric }];
  const paired = columns.length === 2;
  const figuresOf = (row: DistrictRow) => columns.map((c) => row[c.key]);
  const ranked = rows
    .filter((r) => figuresOf(r).some((v) => v != null))
    .sort((a, b) => byFigures(figuresOf(a), figuresOf(b)));
  const max = Math.max(0, ...ranked.flatMap((r) => figuresOf(r).map((v) => v ?? 0)));
  // A change needs enough landings on both sides, and no estimate that hides it shows one.
  const changeOf = (row: DistrictRow) => {
    if (isThin(row) || !row.previous || (row.previous.n_submissions ?? 0) < FEW_LANDINGS)
      return null;
    if (changeHidden(metric, row.sampling_rate)) return null;
    return yearChange(row[metric], row.previous[metric]);
  };
  const showChange = ranked.some((r) => changeOf(r) != null);
  // The change follows the column it belongs to: the metric's own.
  const changeAfter = (key: MetricKey) => showChange && key === metric;

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("text-district")}</TableHead>
            <TableHead>{t("text-region")}</TableHead>
            {columns.map(({ key }) => (
              <Fragment key={key}>
                {/* The figure and its bar in two cells, so the table sizes the figures and every bar starts level. */}
                <TableHead colSpan={2}>
                  {methodTitle(t, key)}
                  {unit && <span className="font-normal text-muted-foreground"> ({unit})</span>}
                </TableHead>
                {changeAfter(key) && (
                  <TableHead className="text-right">
                    {t(keys ? "text-vs-year-earlier-tracker" : "text-vs-year-earlier")}
                  </TableHead>
                )}
              </Fragment>
            ))}
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
                {columns.map(({ key, method }) => (
                  <Fragment key={key}>
                    <TableCell className="pr-1 text-right tabular-nums">
                      {row[key] == null ? "–" : formatValue(key, row[key], lang)}
                    </TableCell>
                    <TableCell className={paired ? "w-[22%]" : "w-[34%]"}>
                      {row[key] != null && (
                        <Bar
                          value={row[key]}
                          max={max}
                          faded={thin}
                          color={method && METHOD_COLOR[method]}
                        />
                      )}
                    </TableCell>
                    {changeAfter(key) && (
                      <TableCell className="text-right">
                        {change != null ? <Change pct={change} /> : "–"}
                      </TableCell>
                    )}
                  </Fragment>
                ))}
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
      {paired && (
        <Legend
          items={methods.map((method) => ({
            label: t(`text-method-${method}`),
            color: METHOD_COLOR[method],
          }))}
        />
      )}
    </div>
  );
}
