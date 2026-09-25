"use client";

import { useMemo } from "react";
import { InfoIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";
import { Separator } from "@workspace/ui/components/separator";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/utils";
import { useT } from "@/app/i18n/use-lang";
import { COLOR_RANGE, TIME_BREAKS } from "@/lib/grid-map/config";
import { calculateStats } from "@/lib/grid-map/stats";
import type { ChoroplethLegend, DataPoint } from "@/lib/grid-map/types";

const rgb = (c: number[]) => `rgb(${c.join(",")})`;
const gradient = (colors: number[][]) => `linear-gradient(to right, ${colors.map(rgb).join(", ")})`;

/** Gradient legend for the district colours, shown over the map. */
export function MetricLegend({ legend, className }: { legend: ChoroplethLegend; className?: string }) {
  return (
    <Card size="sm" className={cn("w-52", className)}>
      <CardContent className="flex flex-col gap-1.5 text-xs">
        <span className="font-medium">{legend.metricLabel}</span>
        <div className="h-2 rounded-full" style={{ background: gradient(legend.colors) }} />
        <div className="flex justify-between text-muted-foreground">
          <span>{legend.minLabel}</span>
          <span>{legend.maxLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Effort ranges under the map: the swatches are the grid legend and toggle which cells are drawn. */
export function EffortToolbar({
  data,
  selectedLabels,
  onSelectedLabelsChange,
}: {
  data: DataPoint[];
  selectedLabels: string[];
  onSelectedLabelsChange: (labels: string[]) => void;
}) {
  const { t, lang } = useT();
  const stats = useMemo(() => calculateStats(data), [data]);
  const decimal = (v: number) => v.toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-xs font-medium text-muted-foreground uppercase">{t("info-average-time-spent")}</span>
      <ToggleGroup
        multiple
        variant="outline"
        size="sm"
        spacing={1}
        value={selectedLabels}
        onValueChange={onSelectedLabelsChange}
        aria-label={t("info-time-ranges")}
        className="flex-wrap"
      >
        {TIME_BREAKS.map((range, i) => (
          <ToggleGroupItem key={range.label} value={range.label} aria-label={range.label}>
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: rgb(COLOR_RANGE[i]) }} />
            {range.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <span>
          {t("info-total-visits", { count: stats.totalVisits })} · {t("info-active-cells", { count: stats.gridCells })}
        </span>
        <HoverCard>
          <HoverCardTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label={t("info-fishing-effort-title")} />}
          >
            <InfoIcon />
          </HoverCardTrigger>
          <HoverCardContent align="end" className="w-80">
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-medium">{t("info-fishing-effort-title")}</p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">{t("info-grid-resolution")}</strong>{" "}
                {t("info-grid-resolution-value")}. {t("info-each-cell")}
              </p>
              <Separator />
              <ul className="flex flex-col gap-1 text-muted-foreground">
                <li>{t("info-avg-time", { value: decimal(stats.avgTime) })}</li>
                <li>{t("info-max-time", { value: decimal(stats.maxTime) })}</li>
                <li>{t("info-avg-speed", { value: decimal(stats.avgSpeed) })}</li>
              </ul>
              <p className="text-xs text-muted-foreground">{t("info-rotate-hint")}</p>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>
    </div>
  );
}
