import { useT } from "@/i18n/use-lang";
import { SwatchToggle } from "@/components/filters/swatch-toggle";
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
    <SwatchToggle
      label={t("text-method")}
      value={value}
      options={METHODS.map((m) => ({
        value: m,
        label: t(`text-method-${m}-short`),
        color: METHOD_COLOR[m],
      }))}
      onChange={(method) => {
        trackEvent("filter_method_change", { method, control_source: source });
        onChange(method);
      }}
    />
  );
}
