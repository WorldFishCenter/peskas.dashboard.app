import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { useT } from "@/i18n/use-lang";
import { CHOSEN } from "@/components/filters/toggle-states";
import { trackEvent } from "@/lib/analytics";
import { TIME_RANGES, useScope } from "@/store/filters";

/** The months the page covers, as one visible row of choices rather than a menu. */
export function TimeRangeToggle() {
  const { t } = useT();
  const { range, setRange } = useScope();

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={t("text-time-range")}
      value={[String(range)]}
      onValueChange={(value) => {
        // Re-picking the current range is not a filter change.
        const next = TIME_RANGES.find((r) => String(r) === value[0]);
        if (next === undefined || next === range) return;
        trackEvent("filter_time_range_change", { time_range: String(next) });
        setRange(next);
      }}
    >
      {TIME_RANGES.map((r) => (
        <ToggleGroupItem key={r} value={String(r)} className={CHOSEN}>
          {r === "all" ? t("text-all-time") : t("text-range-months", { count: r })}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
