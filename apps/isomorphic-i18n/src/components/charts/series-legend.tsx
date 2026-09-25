import { useState } from "react";
import type { ChartConfig } from "@workspace/ui/components/chart";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";

export type Series = { key: string; label?: string; color: string };

/**
 * Hideable series for a chart: the clickable legend (each pressed item is a
 * visible series), which series are hidden, and the chart config labelling
 * them. `pinned` series stay visible.
 */
export function useSeriesToggle(series: Series[], pinned: string[] = []) {
  const [hidden, setHidden] = useState<string[]>([]);
  const keys = series.map((s) => s.key);
  const isHidden = (key: string) => hidden.includes(key);
  const visibleKeys = keys.filter((k) => !isHidden(k));

  return {
    isHidden,
    visibleKeys,
    chartConfig: Object.fromEntries(series.map((s) => [s.key, { label: s.label ?? s.key }])) satisfies ChartConfig,
    legend: (
      <ToggleGroup
        multiple
        variant="outline"
        size="sm"
        spacing={1}
        value={visibleKeys}
        onValueChange={(visible) => setHidden(keys.filter((k) => !visible.includes(k) && !pinned.includes(k)))}
        className="w-full flex-wrap justify-center"
      >
        {series.map((s) => (
          <ToggleGroupItem key={s.key} value={s.key}>
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label ?? s.key}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    ),
  };
}
