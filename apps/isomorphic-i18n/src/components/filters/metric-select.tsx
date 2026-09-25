"use client";

import { useEffect } from "react";
import { useAtom, type PrimitiveAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useT } from "@/app/i18n/use-lang";
import { trackEvent } from "@/lib/analytics";
import { metricTitle, type MetricKey } from "@/lib/dashboard/metrics";

export function MetricSelect({
  metricAtom,
  options,
  fallback,
  controlSource,
}: {
  metricAtom: PrimitiveAtom<MetricKey>;
  options: readonly MetricKey[];
  /** Used when the stored metric isn't offered on this page. */
  fallback: MetricKey;
  controlSource: "header" | "district_widget";
}) {
  const { t } = useT();
  const [metric, setMetric] = useAtom(metricAtom);

  useEffect(() => {
    if (!options.includes(metric)) setMetric(fallback);
  }, [metric, options, fallback, setMetric]);

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
