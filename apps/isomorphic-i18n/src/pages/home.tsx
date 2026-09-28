import { DistrictComparison } from "@/components/dashboard/district-comparison";
import { GridMap } from "@/components/dashboard/grid-map";
import { EstimatesCard, HeadlineState, RecordedTiles } from "@/components/dashboard/headline";
import { hasComparison } from "@/lib/dashboard/metrics";
import { ChartCard } from "@/components/charts/chart-card";
import { useT } from "@/i18n/use-lang";
import { numberLocale } from "@/lib/dashboard/format";
import { useScope } from "@/store/filters";
import { api } from "@/trpc/react";

/** The country at a glance: what the surveyed landings show, the estimates, the districts side by side, where boats fish. */
export default function HomePage() {
  const { t, lang } = useT();
  const { months } = useScope();
  const { data, isLoading, error } = api.summaries.headline.useQuery({ months });
  const landings = data?.metrics.n_submissions.value;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold">
          {t("section-recorded")}
          {data && (
            <span className="text-[13px] font-normal text-muted-foreground">
              {hasComparison(data)
                ? t("section-recorded-note", {
                    landings: (landings ?? 0).toLocaleString(numberLocale(lang)),
                  })
                : t("section-recorded-first-year")}
            </span>
          )}
        </h2>
        {data ? (
          <>
            <RecordedTiles data={data} />
            <EstimatesCard data={data} />
          </>
        ) : (
          <HeadlineState isLoading={isLoading} error={error} />
        )}
      </section>
      <DistrictComparison />
      {/* Printed, the basemap and the grid come apart: the map stays on screen. */}
      <ChartCard
        id="effort-map"
        title={t("title-effort-map")}
        description={t("text-effort-map-description")}
        info="info-map"
        className="print:hidden"
      >
        <GridMap mode="effort" className="h-[520px]" />
      </ChartCard>
    </div>
  );
}
