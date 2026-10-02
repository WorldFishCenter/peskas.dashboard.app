import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { RankedBars, type RankedRow } from "@/components/charts/ranked-bars";
import { formatNumber, formatPercent } from "@/lib/dashboard/format";
import { compositionInfo } from "@/lib/dashboard/metrics";
import { useSpeciesName } from "@/lib/dashboard/species";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

const TOP_N = 15;

/** The species groups that make up the recorded catch of the selection, largest first. */
export function SpeciesRanking() {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.composition.useQuery(
    { ...scope.input, metric: "catch_kg" },
    scope.options,
  );
  const name = useSpeciesName();

  const all = query.data ?? [];
  const total = all.reduce((sum, s) => sum + s.total, 0);
  const top = all.slice(0, TOP_N);
  const rows: RankedRow[] = top.map((s) => ({
    label: name(s.taxon) || t("text-unknown"),
    value: total ? (100 * s.total) / total : 0,
    detail: [name(s.taxon) !== s.taxon && s.taxon, `${formatNumber(s.total / 1000, lang)} t`]
      .filter(Boolean)
      .join(" · "),
  }));
  const shown = total ? (100 * top.reduce((sum, s) => sum + s.total, 0)) / total : 0;

  return (
    <ChartCard
      id="species-ranking"
      title={t("title-species-ranking")}
      description={t("text-species-ranking-description")}
      info={compositionInfo(t)}
      download={all.map((s) => ({ taxon: s.taxon, recorded_catch_kg: s.total }))}
      footer={
        all.length > TOP_N &&
        t("text-species-ranking-footer", {
          count: TOP_N,
          share: formatPercent(shown, lang),
          total: all.length,
        })
      }
    >
      <ChartGate
        query={query}
        isEmpty={!rows.length}
        emptyDescription={t("text-no-data-available-for-districts")}
      >
        <RankedBars
          rows={rows}
          name={t("text-share-of-recorded-catch")}
          format={(v) => formatPercent(v, lang)}
        />
      </ChartGate>
    </ChartCard>
  );
}
