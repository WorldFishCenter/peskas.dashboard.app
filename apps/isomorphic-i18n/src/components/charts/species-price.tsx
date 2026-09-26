import { useT } from "@/i18n/use-lang";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartGate } from "@/components/charts/chart-state";
import { RankedBars, type RankedRow } from "@/components/charts/ranked-bars";
import { activeCountry } from "@/config/countryConfig";
import { speciesPriceInfo } from "@/lib/dashboard/metrics";
import { useDistrictScope } from "@/store/filters";
import { api } from "@/trpc/react";

const TOP_N = 15;

/** Price per kg at landing of the most-landed species that have a price, dearest first. */
export function SpeciesPrice({ className }: { className?: string }) {
  const { t, lang } = useT();
  const scope = useDistrictScope();
  const query = api.summaries.speciesPrice.useQuery(scope.input, scope.options);

  const rows: RankedRow[] = (query.data?.rows ?? [])
    .slice(0, TOP_N)
    .map((s) => ({
      label: s.taxon,
      value: s.price_kg,
      detail: t("text-recorded-kg", { value: s.catch_kg.toLocaleString(lang, { maximumFractionDigits: 0 }) }),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <ChartCard
      id="species-price"
      className={className}
      title={t("title-species-price")}
      description={t("text-species-price-description", { currency: activeCountry.currencyCode })}
      info={speciesPriceInfo(t)}
      download={query.data?.rows}
      scope={scope}
    >
      <ChartGate
        query={query}
        isEmpty={!rows.length}
        emptyDescription={t(query.data?.available === false ? "text-traits-not-published" : "text-no-species-price")}
      >
        <RankedBars
          rows={rows}
          name={t("metric-mean_price_kg-title")}
          format={(v) => v.toLocaleString(lang, { maximumFractionDigits: 0 })}
        />
      </ChartGate>
    </ChartCard>
  );
}
