import { useAtom, type PrimitiveAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useT } from "@/i18n/use-lang";
import { trackEvent } from "@/lib/analytics";
import type { MetricKey } from "@repo/domain/metrics";
import { metricTitle } from "@/lib/dashboard/metrics";

export function MetricSelect({
  metricAtom,
  options,
  controlSource,
}: {
  metricAtom: PrimitiveAtom<MetricKey>;
  options: readonly MetricKey[];
  controlSource: "header" | "district_widget";
}) {
  const { t } = useT();
  const [metric, setMetric] = useAtom(metricAtom);

  const items = options.map((value) => ({ value, label: metricTitle(t, value) }));

  return (
    <Select<MetricKey>
      items={items}
      value={metric}
      onValueChange={(value) => {
        if (value === null || value === metric) return;
        trackEvent("filter_metric_change", { metric: value, control_source: controlSource });
        setMetric(value);
      }}
    >
      <SelectTrigger size="sm" aria-label={t("text-metric")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
