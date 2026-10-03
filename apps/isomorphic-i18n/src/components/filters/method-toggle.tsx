import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { useT } from "@/i18n/use-lang";
import { CHOSEN } from "@/components/filters/toggle-states";
import { trackEvent } from "@/lib/analytics";
import { METHODS, type Method } from "@repo/domain/metrics";
import { METHOD_COLOR } from "@/lib/dashboard/metrics";

/**
 * Which method's estimates a view that shows one at a time draws (the district
 * map, the seasonality table), each choice keyed by its line colour.
 */
export function MethodToggle({
  value,
  onChange,
  source,
}: {
  value: Method;
  onChange: (method: Method) => void;
  /** The view, for analytics (ANALYTICS.md). */
  source: "district_map" | "seasonality";
}) {
  const { t } = useT();
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={t("text-method")}
      value={[value]}
      onValueChange={(next) => {
        const method = next[0] as Method | undefined;
        if (!method || method === value) return;
        trackEvent("filter_method_change", { method, control_source: source });
        onChange(method);
      }}
    >
      {METHODS.map((m) => (
        <ToggleGroupItem key={m} value={m} className={CHOSEN}>
          {/* Ringed in the background colour, so it shows on the chosen item's accent too. */}
          <span
            aria-hidden
            className="h-1 w-3.5 rounded-full ring-1 ring-background"
            style={{ backgroundColor: METHOD_COLOR[m] }}
          />
          {t(`text-method-${m}-short`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
