import { useCallback } from "react";
import type { MaturityPosition } from "@repo/domain/sizes";
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

/** Catch against the length at maturity: the length chart's bars, RangeBar and MaturityLegend. */
export const MATURITY_FILL: Record<MaturityPosition, string> = {
  below: "var(--concern-2)",
  spanning: "var(--concern-1)",
  above: "var(--chart-1)",
};
