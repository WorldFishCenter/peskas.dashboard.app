import { TriangleAlertIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { sampleSize } from "@repo/domain/metrics";
import { useT } from "@/i18n/use-lang";
import { activeCountry } from "@/config/countryConfig";
import { monthLabel } from "@/lib/dashboard/format";
import { api } from "@/trpc/react";

/** The query scope a card rests on: the district selection and month window. */
export type Scope = { input: { districts?: string[]; months?: number }; options?: { enabled: boolean } };

/** Amber warning sign for figures that rest on too little data. */
export function WarningIcon({ className, label }: { className?: string; label?: string }) {
  return (
    <TriangleAlertIcon
      className={cn("size-3.5 shrink-0 text-amber-600 dark:text-amber-400", className)}
      aria-label={label}
      aria-hidden={!label}
    />
  );
}

const DOTS = { small: 1, medium: 2, large: 3 };

/**
 * What a chart rests on: the landings surveyed in its scope, how many of the
 * scope's districts they come from, the latest month with data, and dots for
 * the size of that sample. Cards on one page share the scope, so they share
 * the one query.
 */
export function ScopeNote({ input, options }: Scope) {
  const { t, lang } = useT();
  const { data } = api.summaries.coverage.useQuery(input, options);
  if (!data) return null;

  const total = input.districts?.length ?? activeCountry.districts.length;
  const size = sampleSize(data.landings);
  const label = t(`text-sample-${size}`);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {size === "small" && data.landings > 0 && <WarningIcon />}
      {t("text-scope-note", {
        count: data.landings,
        landings: data.landings.toLocaleString(lang),
        districts: data.districts,
        total,
        month: data.through ? monthLabel(data.through, lang, "long") : "-",
      })}
      <span className="tracking-widest" title={label} aria-label={label}>
        · {"●".repeat(DOTS[size])}
        {"○".repeat(3 - DOTS[size])}
      </span>
    </span>
  );
}
