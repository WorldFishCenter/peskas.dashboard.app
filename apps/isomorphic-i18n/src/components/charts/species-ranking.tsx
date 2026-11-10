import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { RankedBars, type RankedRow } from "@/components/charts/ranked-bars";
import { CoverageBadge } from "@/components/dashboard/headline";
import { Linked } from "@/components/linked-text";
import { formatNumber, formatPercent } from "@/lib/dashboard/format";
import {
  byFigures,
  compositionInfo,
  formatValue,
  SPECIES_FIGURE,
  speciesBothInfo,
} from "@/lib/dashboard/metrics";
import { useSpeciesEstimates, useSpeciesName } from "@/lib/dashboard/species";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

const TOP_N = 15;
const { recorded, artfish } = SPECIES_FIGURE;
/** From this share of the recorded catch in estimated district-months up, it reads as all of it and goes unsaid. */
const ALL_RECORDED_COVERED = 0.995;

/** Each taxon's total and its share of all, by taxon (a null taxon keyed as ""). */
function shares(rows: readonly { taxon: string | null; total: number }[]) {
  const all = rows.reduce((sum, s) => sum + s.total, 0);
  return new Map(
    rows.map((s) => [s.taxon ?? "", { total: s.total, share: all ? (100 * s.total) / all : 0 }]),
  );
}

/**
 * The species groups that make up the catch of the selection: their share of
 * the recorded catch, and, once the portal has it, beside each its share of
 * the catch every boat lands as the FAO ARTFISH method estimates it, with the
 * tonnes. Both as shares on one axis, so where the two rank a group apart
 * shows at a glance. The groups shown are the largest by either figure, in
 * the recorded order.
 */
export function SpeciesRanking() {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const recordedQuery = api.summaries.composition.useQuery(
    { ...scope.input, metric: "catch_kg" },
    scope.options,
  );
  const estimates = useSpeciesEstimates();
  const name = useSpeciesName();

  const recordedShares = shares(recordedQuery.data ?? []);
  const estimatedShares = shares(estimates.data?.rows ?? []);
  // The portal returns no rows until it has the estimates, so any row means there are some to show.
  const showEstimates = estimatedShares.size > 0;
  const pct = (v: number) => formatPercent(v, lang);

  // The largest groups by either figure, then in the recorded order.
  const taxa = [...new Set([...recordedShares.keys(), ...estimatedShares.keys()])];
  const figures = (k: string) => [recordedShares.get(k)?.share, estimatedShares.get(k)?.share];
  const larger = (k: string) => Math.max(...figures(k).map((share) => share ?? 0));
  const top = [...taxa]
    .sort((a, b) => larger(b) - larger(a))
    .slice(0, TOP_N)
    .sort((a, b) => byFigures(figures(a), figures(b)));
  const rows: RankedRow[] = top.map((k) => {
    const r = recordedShares.get(k);
    const e = estimatedShares.get(k);
    const taxon = k || null;
    return {
      label: name(taxon) || t("text-unknown"),
      value: r?.share ?? 0,
      detail: [
        name(taxon) !== taxon && taxon,
        r && t("text-recorded-kg", { value: formatNumber(r.total, lang) }),
      ]
        .filter(Boolean)
        .join(" · "),
      compare: e?.share ?? null,
      compareLabel: e && `${pct(e.share)} · ${formatValue(artfish.metric, e.total, lang)} t`,
    };
  });
  const sumShares = (m: typeof recordedShares) =>
    pct(top.reduce((s, k) => s + (m.get(k)?.share ?? 0), 0));
  const recordedInCovered = estimates.data?.recordedCovered ?? 1;

  return (
    <ChartCard
      id="species-ranking"
      title={t("title-species-ranking")}
      description={t(
        showEstimates
          ? "text-species-ranking-description-both"
          : "text-species-ranking-description",
      )}
      info={showEstimates ? speciesBothInfo(t) : compositionInfo(t)}
      download={taxa.map((k) => ({
        taxon: k || null,
        recorded_catch_kg: recordedShares.get(k)?.total ?? null,
        recorded_share: recordedShares.get(k)?.share ?? null,
        ...(showEstimates && {
          estimated_catch_tn_fao: estimatedShares.get(k)?.total ?? null,
          estimated_share: estimatedShares.get(k)?.share ?? null,
        }),
      }))}
      footer={
        rows.length > 0 && (
          <>
            {showEstimates && estimates.coverage && (
              <div>
                <CoverageBadge
                  coverage={estimates.coverage}
                  single={scope.input.districts.length === 1}
                />
              </div>
            )}
            {showEstimates && recordedInCovered < ALL_RECORDED_COVERED && (
              <p>
                {t("text-species-estimate-in-covered", { share: pct(100 * recordedInCovered) })}
              </p>
            )}
            {estimates.data?.available && !showEstimates && (
              <p>
                <Linked text={t("text-species-estimate-none")} />
              </p>
            )}
            {estimates.failed && (
              <p>
                <Linked text={t("text-species-estimate-failed")} />
              </p>
            )}
            {taxa.length > TOP_N && (
              <p>
                {showEstimates
                  ? t("text-species-ranking-footer-both", {
                      count: TOP_N,
                      recorded: sumShares(recordedShares),
                      estimated: sumShares(estimatedShares),
                      total: taxa.length,
                    })
                  : t("text-species-ranking-footer", {
                      count: TOP_N,
                      share: sumShares(recordedShares),
                      total: taxa.length,
                    })}
              </p>
            )}
          </>
        )
      }
    >
      <ChartGate
        query={recordedQuery}
        isEmpty={!rows.length}
        emptyDescription={t("text-no-data-available-for-districts")}
      >
        <RankedBars
          rows={rows}
          name={t("text-share-of-recorded-catch")}
          format={pct}
          color={showEstimates ? recorded.color : undefined}
          compare={
            showEstimates
              ? { name: t("text-share-of-estimated-catch"), color: artfish.color }
              : undefined
          }
        />
      </ChartGate>
    </ChartCard>
  );
}
