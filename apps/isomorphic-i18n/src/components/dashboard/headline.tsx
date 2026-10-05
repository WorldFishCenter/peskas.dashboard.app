import { Link } from "react-router";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import {
  changeHidden,
  confidenceBand,
  methodKeys,
  METHODS,
  type MetricKey,
} from "@repo/domain/metrics";
import { ChartState } from "@/components/charts/chart-state";
import { WarningIcon } from "@/components/charts/warning-icon";
import { StatTile } from "@/components/dashboard/stat-tile";
import { pages, type PageMetric } from "@/config/routes";
import { useScopedHref, useT } from "@/i18n/use-lang";
import { trackEvent } from "@/lib/analytics";
import { formatPercent, shareRange } from "@/lib/dashboard/format";
import { useDistrictScope, usePageMetric } from "@/store/filters";
import { api } from "@/trpc/react";
import {
  ESTIMATED,
  estimateInfo,
  formatValue,
  isEstimatedTotal,
  METHOD_COLOR,
  metricInfo,
  metricTitle,
  metricUnit,
  partialCoverage,
  RECORDED,
  yearChange,
  type Headline,
} from "@/lib/dashboard/metrics";

type Translate = ReturnType<typeof useT>["t"];

/**
 * A tile's figure, change and sparkline for one metric; an estimate is
 * rounded, and shows no change where `changeHidden` says so. An estimate
 * both methods make lists the methods with a figure, each with its own change.
 */
function tileProps(t: Translate, lang: string, data: Headline, metric: MetricKey) {
  const m = data.metrics[metric];
  const change = (key: MetricKey) => {
    const { value, previous } = data.metrics[key];
    return {
      pct: changeHidden(key, data.samplingRate) ? null : yearChange(value, previous),
      previous: formatValue(key, previous, lang),
    };
  };
  const keys = methodKeys(metric);
  const methods = keys
    ? METHODS.filter((method) => data.metrics[keys[method]].value != null).map((method) => ({
        method,
        label: t(`text-method-${method}-short`),
        color: METHOD_COLOR[method],
        value: formatValue(keys[method], data.metrics[keys[method]].value, lang),
        change: change(keys[method]),
      }))
    : [];
  return {
    id: `headline-${metric}`,
    label: metricTitle(t, metric),
    value: formatValue(metric, m.value, lang),
    unit: metricUnit(t, metric),
    methods: methods.length ? methods : undefined,
    change: methods.length ? null : change(metric),
    spark: m.series.map((p) => p.value),
  };
}

/**
 * Estimated totals that leave part of the selection out, flagged like the
 * confidence of the estimates: the share of its districts and months they add
 * up (a range where they differ), of its months alone for one district (`single`).
 */
export function CoverageBadge({
  coverage,
  single,
}: {
  coverage: NonNullable<ReturnType<typeof partialCoverage>>;
  single?: boolean;
}) {
  const { t, lang } = useT();
  return (
    <Badge variant="outline">
      <WarningIcon />
      {t(single ? "text-coverage-share-months" : "text-coverage-share", {
        pct: shareRange(t, lang, coverage),
      })}
    </Badge>
  );
}

/** Four tiles of recorded figures, each against the same months a year earlier. */
export function RecordedTiles({ data }: { data: Headline }) {
  const { t, lang } = useT();
  // A measure this database doesn't carry (older coasts output) gets no tile rather than a "-".
  const shown = RECORDED.filter((m) => data.metrics[m].value != null);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {shown.map((metric) => (
        <Card key={metric}>
          <CardContent>
            <StatTile
              {...tileProps(t, lang, data, metric)}
              info={metric === "n_submissions" ? undefined : metricInfo(t, metric)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * The estimated totals in one card with their confidence. They rest on the
 * share of boats tracked; while that is low their change on a year earlier
 * says more about which boats carried trackers than about the fishery, so it
 * isn't shown, and the figures are rounded to what they can bear. Where the
 * FAO ARTFISH method estimates too, each tile shows both methods' figures.
 */
export function EstimatesCard({ data }: { data: Headline }) {
  const { t, lang } = useT();
  const scoped = useScopedHref();
  const confidence = confidenceBand(data.samplingRate);
  const low = confidence === "low";
  // The estimates with a figure by either method.
  const shown = ESTIMATED.map((metric) => ({
    metric,
    tile: tileProps(t, lang, data, metric),
  })).filter(({ tile }) => tile.methods);
  const artfish = shown.some(({ tile }) => tile.methods?.some((r) => r.method === "artfish"));
  if (!shown.length) return null;
  const coverage = partialCoverage(
    data,
    shown.map(({ metric }) => metric),
  );
  const note = artfish
    ? t(low ? "text-estimates-rounded-both" : "text-estimates-artfish")
    : low && t("text-estimates-low");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title-estimates")}</CardTitle>
        {/* The link beside the title only, so the description keeps the card's width on a phone. */}
        {artfish && (
          <CardDescription className="col-span-2">{t("text-estimates-two")}</CardDescription>
        )}
        <CardAction className="row-span-1">
          <Link to={`${scoped(pages.about.path)}#estimates`} className="link text-sm">
            {t("text-estimates-how")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {shown.map(({ metric, tile }) => (
          <StatTile key={metric} {...tile} spark={undefined} info={estimateInfo(t, metric)} />
        ))}
      </CardContent>
      {(confidence || note || coverage) && (
        <CardFooter className="flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          {coverage && <CoverageBadge coverage={coverage} />}
          {confidence && (
            <>
              <Badge variant="outline">
                {low && <WarningIcon />}
                {t(artfish ? "text-confidence-level-tracker" : "text-confidence-level", {
                  level: t(`text-confidence-${confidence}`),
                })}
              </Badge>
              <span>
                {t("text-boats-tracked", {
                  pct: formatPercent(100 * (data.samplingRate ?? 0), lang),
                })}
              </span>
            </>
          )}
          {note && <span>{note}</span>}
        </CardFooter>
      )}
    </Card>
  );
}

/** Placeholder with the shape of the tiles, and the error or empty state instead of them. */
export function HeadlineState({ isLoading, error }: { isLoading: boolean; error: unknown }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {RECORDED.map((m) => (
          <Skeleton key={m} className="h-40" />
        ))}
      </div>
    );
  }
  return <ChartState status={error ? "error" : "empty"} className="h-40" />;
}

/**
 * The page's measures as tiles over the district selection, each against a
 * year earlier; the tile picked is the measure the charts below show.
 * Estimates on low confidence are rounded and show no change, as on the
 * overview. The tiles keep to their figures: what the estimated totals cover
 * is said once, under the row or, when an estimate is charted, under its chart.
 */
export function MetricPicker({ page }: { page: PageMetric }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const { data, isLoading, error } = api.summaries.headline.useQuery(scope.input, scope.options);
  const [metric, setMetric] = usePageMetric(page);
  if (!data) return <HeadlineState isLoading={isLoading || !scope.options.enabled} error={error} />;
  const tiles = page.options.map((key) => ({ key, tile: tileProps(t, lang, data, key) }));
  const coverage = partialCoverage(data, page.options);

  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        variant="outline"
        spacing={4}
        aria-label={t("text-metric")}
        value={[metric]}
        onValueChange={(value) => {
          const next = value[0] as MetricKey | undefined;
          if (!next || next === metric) return;
          trackEvent("filter_metric_change", { metric: next, control_source: "page" });
          setMetric(next);
        }}
        className="grid w-full grid-cols-1 items-stretch sm:grid-cols-2 xl:grid-cols-4"
      >
        {tiles.map(({ key, tile }) => (
          <ToggleGroupItem
            key={key}
            value={key}
            // The charted measure is marked in the accent colour, so the tiles read as a choice.
            className="h-auto items-stretch p-4 font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:ring-1 aria-pressed:ring-primary"
          >
            <StatTile {...tile} spark={undefined} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {/* Under the tiles while a recorded figure is charted: an estimate's own chart carries it below. */}
      {coverage && !isEstimatedTotal(metric) && (
        <div>
          <CoverageBadge coverage={coverage} single={scope.input.districts.length === 1} />
        </div>
      )}
    </div>
  );
}
