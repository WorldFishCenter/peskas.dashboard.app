import { Link } from "react-router";
import { FEW_LANDINGS } from "@repo/domain/metrics";
import { DistrictFilter } from "@/components/filters/district-filter";
import { TimeRangeToggle } from "@/components/filters/time-range-toggle";
import { WarningIcon } from "@/components/charts/warning-icon";
import { activeCountry } from "@/config/countryConfig";
import { pages, useCurrentPage } from "@/config/routes";
import { useScopedHref, useT } from "@/i18n/use-lang";
import { monthSpan, numberLocale } from "@/lib/dashboard/format";
import { useScope } from "@/store/filters";
import { api } from "@/trpc/react";

/**
 * The page's name and question, its filters, and one line saying what every
 * figure below rests on. Cards repeat that only when their scope differs.
 */
export function PageHeader() {
  const { t } = useT();
  const page = useCurrentPage();
  if (!page) return null;

  return (
    <header className="flex flex-col gap-3 border-b pb-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-3xl flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t(page.titleKey)}</h1>
          <p className="text-muted-foreground">{t(page.introKey)}</p>
        </div>
        {page.timeRange && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {page.districts && <DistrictFilter />}
            <TimeRangeToggle />
          </div>
        )}
      </div>
      {page.timeRange && <ScopeLine followsDistricts={!!page.districts} />}
    </header>
  );
}

/** Landings, districts, months and the last update behind the page's figures. */
function ScopeLine({ followsDistricts }: { followsDistricts: boolean }) {
  const { t, lang } = useT();
  const scoped = useScopedHref();
  const { districts, months } = useScope();
  const input = followsDistricts ? { districts, months } : { months };
  const { data } = api.summaries.coverage.useQuery(input, {
    enabled: !followsDistricts || districts.length > 0,
  });
  // Keep the line's height while loading, so the page doesn't jump.
  if (!data) return <p className="h-5" />;

  const first = data.cells.reduce<string | null>(
    (min, c) => (min && min < c.month ? min : c.month),
    null,
  );
  const total = followsDistricts ? districts.length : activeCountry.districts.length;
  const few = data.landings > 0 && data.landings < FEW_LANDINGS;

  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
      {data.landings > 0 ? (
        <>
          <span className="flex items-center gap-1">
            {few && <WarningIcon label={t("text-scope-few-landings")} />}
            {t("text-scope-landings", {
              count: data.landings,
              formatted: data.landings.toLocaleString(numberLocale(lang)),
            })}
          </span>
          <span>{t("text-scope-districts", { count: data.districts, total })}</span>
          {first && data.through && <span>{monthSpan(first, data.through, lang)}</span>}
        </>
      ) : (
        <span>{t("text-scope-none")}</span>
      )}
      {data.updatedAt && (
        <span>
          {t("text-scope-updated", {
            date: data.updatedAt.toLocaleDateString(lang, { dateStyle: "long" }),
          })}
        </span>
      )}
      <Link to={scoped(pages.about.path)} className="link text-foreground sm:ml-auto print:hidden">
        {t("text-scope-methods")}
      </Link>
    </p>
  );
}
