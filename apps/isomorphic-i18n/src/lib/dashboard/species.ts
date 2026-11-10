import { useCallback } from "react";
import type { MaturityPosition } from "@repo/domain/sizes";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

/**
 * A taxon's name for readers: its common name from FishBase ("Yellowfin
 * tuna", with FishBase's "nei", not elsewhere included, dropped), else the
 * scientific name. Names don't depend on the scope, so the one query is kept.
 */
export function useSpeciesName() {
  const { data } = api.summaries.speciesNames.useQuery(undefined, { staleTime: Infinity });
  return useCallback(
    (taxon: string | null | undefined) =>
      taxon ? data?.[taxon]?.replace(/ nei$/, "") ?? taxon : "",
    [data],
  );
}

/**
 * The FAO ARTFISH species estimates of the district selection
 * (`speciesEstimates`), with their coverage for `CoverageBadge`, null when
 * every district-month selected has one, and whether loading them failed, so
 * a card that falls back to the recorded catch can say why.
 */
export function useSpeciesEstimates() {
  const scope = useDistrictScope();
  const query = api.summaries.speciesEstimates.useQuery(scope.input, scope.options);
  // `headline` counts the district-months selected, which the coverage is out of (the Catch and Revenue tiles' query).
  const selected = api.summaries.headline.useQuery(scope.input, scope.options).data?.districtMonths;
  const coveredShare = selected && query.data ? query.data.covered / selected : null;
  return {
    data: query.data,
    failed: query.isError,
    coverage:
      coveredShare != null && coveredShare < 1 ? { least: coveredShare, most: coveredShare } : null,
  };
}

/** Catch against the length at maturity: the length chart's bars, RangeBar and MaturityLegend. */
export const MATURITY_FILL: Record<MaturityPosition, string> = {
  below: "var(--concern-2)",
  spanning: "var(--concern-1)",
  above: "var(--chart-1)",
};
