import { Link } from "react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { confidenceBand, type MetricKey } from "@repo/domain/metrics";
import { ChartState } from "@/components/charts/chart-state";
import { WarningIcon } from "@/components/charts/warning-icon";
import { StatTile } from "@/components/dashboard/stat-tile";
import { pages, type PageMetric } from "@/config/routes";
import { useScopedHref, useT } from "@/i18n/use-lang";
import { trackEvent } from "@/lib/analytics";
import { formatApprox, formatNumber, formatPercent } from "@/lib/dashboard/format";
import { useDistrictScope, usePageMetric } from "@/store/filters";
import { api } from "@/trpc/react";
import {
  ESTIMATED,
  isLowConfidenceEstimate,
  metricInfo,
  metricTitle,
  metricUnit,
  RECORDED,
  yearChange,
  type Headline,
} from "@/lib/dashboard/metrics";

type Translate = ReturnType<typeof useT>["t"];

/** A tile's figure, change and sparkline for one metric; a low-confidence estimate is rounded and shows no change. */
function tileProps(t: Translate, lang: string, data: Headline, metric: MetricKey) {
  const m = data.metrics[metric];
  const rounded = isLowConfidenceEstimate(metric, data.samplingRate);
  return {
    id: `headline-${metric}`,
    label: metricTitle(t, metric),
    value: rounded ? `≈${formatApprox(m.value, lang)}` : formatNumber(m.value, lang),
    unit: metricUnit(t, metric),
    change: rounded
      ? null
      : { pct: yearChange(m.value, m.previous), previous: formatNumber(m.previous, lang) },
    spark: m.series.map((p) => p.value),
  };
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
 * isn't shown, and the figures are rounded to what they can bear.
 */
export function EstimatesCard({ data }: { data: Headline }) {
  const { t, lang } = useT();
  const scoped = useScopedHref();
  const confidence = confidenceBand(data.samplingRate);
  const low = confidence === "low";
  const shown = ESTIMATED.filter((m) => data.metrics[m].value != null);
  if (!shown.length) return null;

  return (
    <Card>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_1fr]">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("title-estimates")}</h3>
          {confidence && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {low && <WarningIcon />}
                {t("text-confidence-level", { level: t(`text-confidence-${confidence}`) })}
              </Badge>
              <span className="text-[13px] text-muted-foreground">
                {t("text-boats-tracked", {
                  pct: formatPercent(100 * (data.samplingRate ?? 0), lang),
                })}
              </span>
            </div>
          )}
          <p className="text-[13px] text-muted-foreground">
            {low && `${t("text-estimates-low")} `}
            <Link to={`${scoped(pages.about.path)}#estimates`} className="link text-foreground">
              {t("text-estimates-how")}
            </Link>
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {shown.map((metric) => (
            <StatTile
              key={metric}
              {...tileProps(t, lang, data, metric)}
              spark={undefined}
              info={metricInfo(t, metric)}
            />
          ))}
        </div>
      </CardContent>
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
 * Estimates on low confidence are rounded and show no change, as on the overview.
 */
export function MetricPicker({ page }: { page: PageMetric }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const { data, isLoading, error } = api.summaries.headline.useQuery(scope.input, scope.options);
  const [metric, setMetric] = usePageMetric(page);
  if (!data) return <HeadlineState isLoading={isLoading || !scope.options.enabled} error={error} />;

  return (
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
      className="grid w-full grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
    >
      {page.options.map((key) => (
        <ToggleGroupItem
          key={key}
          value={key}
          // The charted measure is marked in the accent colour, so the tiles read as a choice.
          className="h-auto items-stretch p-4 font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:ring-1 aria-pressed:ring-primary"
        >
          <StatTile
            {...tileProps(t, lang, data, key)}
            note={
              isLowConfidenceEstimate(key, data.samplingRate) && (
                <span className="text-muted-foreground">{t("text-confidence-low-no-change")}</span>
              )
            }
            spark={undefined}
          />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
