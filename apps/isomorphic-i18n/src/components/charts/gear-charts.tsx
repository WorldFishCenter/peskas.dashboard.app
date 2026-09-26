import { useMemo } from "react";
import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { RankedBars, type RankedRow } from "@/components/charts/ranked-bars";
import { GearSpeciesComposition } from "@/components/charts/species-composition";
import { activeCountry } from "@/config/countryConfig";
import { FEW_LANDINGS, METRICS } from "@repo/domain/metrics";
import { immatureByGear } from "@repo/domain/sizes";
import { formatDashboardNumber, formatPercent, gearLabel } from "@/lib/dashboard/format";
import { metricInfo, metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { BELOW_MATURITY_COLOR } from "@/lib/dashboard/palettes";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

/**
 * Gear page: how much each gear is used, what it catches, its catch and
 * revenue rates, and how much of what it lands is below the size at which the
 * species first mature.
 */
export function GearCharts() {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const gears = api.summaries.byGear.useQuery(scope.input, scope.options);
  const lengths = api.summaries.lengths.useQuery(scope.input, scope.options);
  const landingsLabel = (n: number) => t("text-n-landings", { formatted: n.toLocaleString(lang) });
  const percent = (v: number) => formatPercent(v, lang);

  const named = useMemo(
    () => (gears.data ?? []).map((g) => ({ ...g, name: gearLabel(g.gear, t("text-unknown")) })),
    [gears.data, t]
  );
  const total = named.reduce((sum, g) => sum + g.landings, 0);
  const share: RankedRow[] = named.map((g) => ({
    label: g.name,
    value: (100 * g.landings) / total,
    detail: landingsLabel(g.landings),
  }));

  // Per gear, the least share of the measured catch below maturity; the most is in the tooltip.
  const immature: RankedRow[] = useMemo(
    () =>
      lengths.data
        ? immatureByGear(lengths.data.measured, lengths.data.maturity).map((g) => ({
            label: gearLabel(g.gear, t("text-unknown")),
            value: 100 * g.least,
            detail: `${t("text-share-range", {
              least: formatPercent(100 * g.least, lang),
              most: formatPercent(100 * g.most, lang),
            })} · ${t("text-measured-trips", { count: g.trips })}`,
          }))
        : [],
    [lengths.data, t, lang]
  );

  const rateCard = (metric: "mean_cpue" | "mean_rpue") => {
    const key = METRICS[metric].gearIndicator!;
    const rows: RankedRow[] = named
      .filter((g) => g[key] != null)
      .map((g) => ({ label: g.name, value: g[key]!, detail: landingsLabel(g.landings), thin: g.landings < FEW_LANDINGS }))
      .sort((a, b) => b.value - a.value);
    return (
      <ChartCard
        id={`gear-${key}`}
        title={t(`title-${key}-by-gear`)}
        description={metricUnit(t, metric)}
        info={metricInfo(t, metric)}
        download={rows}
        scope={scope}
      >
        <ChartGate query={gears} isEmpty={!rows.length}>
          <RankedBars rows={rows} name={metricTitle(t, metric)} format={(v) => formatDashboardNumber(v, metric, lang)} />
        </ChartGate>
      </ChartCard>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        id="gear-landings"
        title={t("title-gear-landings")}
        description={t("text-gear-landings-description")}
        info="info-gear-landings"
        download={share}
        scope={scope}
      >
        <ChartGate query={gears} isEmpty={!share.length}>
          <RankedBars rows={share} name={t("text-share-of-landings")} format={percent} />
        </ChartGate>
      </ChartCard>
      <ChartCard
        id="gear-maturity"
        title={t("title-gear-maturity")}
        description={t("text-gear-maturity-description")}
        info="info-maturity"
        download={immature}
        scope={scope}
        footer={activeCountry.survey.meanLengths && t("text-lengths-means-note")}
      >
        <ChartGate
          query={lengths}
          isEmpty={!immature.length}
          emptyDescription={t(lengths.data?.available === false ? "text-lengths-not-published" : "text-no-maturity-data")}
        >
          <RankedBars rows={immature} name={t("text-below-maturity-short")} format={percent} color={BELOW_MATURITY_COLOR} />
        </ChartGate>
      </ChartCard>
      {rateCard("mean_cpue")}
      {rateCard("mean_rpue")}
      <GearSpeciesComposition className="lg:col-span-2" />
    </div>
  );
}
