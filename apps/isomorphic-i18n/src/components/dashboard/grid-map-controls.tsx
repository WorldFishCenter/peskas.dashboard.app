import { useMemo } from "react";
import { InfoIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/utils";
import { useT } from "@/i18n/use-lang";
import { LEGEND_FILTER, SWATCH_ON } from "@/components/filters/toggle-states";
import { TIME_BREAKS } from "@/lib/grid-map/config";
import { calculateStats } from "@/lib/grid-map/stats";
import type { ChoroplethLegend, DataPoint, EffortLayer } from "@/lib/grid-map/types";

const rgb = (c: number[]) => `rgb(${c.join(",")})`;
const gradient = (colors: number[][]) => `linear-gradient(to right, ${colors.map(rgb).join(", ")})`;

/** Gradient legend for the district colours, shown over the map. */
export function MetricLegend({
  legend,
  className,
}: {
  legend: ChoroplethLegend;
  className?: string;
}) {
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

/**
 * Effort map controls, laid out like the district-comparison bar: filters on
 * the left, layer toggles on the right. Sits above the map.
 */
export function EffortToolbar({
  data,
  cellSize,
  colors,
  selectedLabels,
  onSelectedLabelsChange,
  visibleLayers,
  onVisibleLayersChange,
}: {
  data: DataPoint[];
  /** Width of a column at the current zoom, in metres. */
  cellSize: number;
  /** One colour per effort band, as the map draws them. */
  colors: number[][];
  selectedLabels: string[];
  onSelectedLabelsChange: (labels: string[]) => void;
  /** Effort overlays drawn on the map (bars and/or fishing grounds). */
  visibleLayers: EffortLayer[];
  onVisibleLayersChange: (layers: EffortLayer[]) => void;
}) {
  const { t, lang } = useT();
  const stats = useMemo(() => calculateStats(data), [data]);
  const decimal = (v: number) =>
    v.toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const size = cellSize < 1000 ? `${cellSize} m` : `${cellSize / 1000} km`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("info-average-time-spent")}
        </span>
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          spacing={0}
          value={selectedLabels}
          onValueChange={onSelectedLabelsChange}
          aria-label={t("info-time-ranges")}
          className="flex-wrap"
        >
          {TIME_BREAKS.map((range, i) => (
            <ToggleGroupItem
              key={range.label}
              value={range.label}
              aria-label={range.label}
              className={LEGEND_FILTER}
            >
              <span
                className={cn("size-2.5 shrink-0 rounded-[2px]", SWATCH_ON)}
                style={{ backgroundColor: rgb(colors[i]) }}
              />
              {range.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Mapbox-style layer menu: each overlay is independently visible (both may be off). */}
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          spacing={0}
          value={visibleLayers}
          // Base UI gives string[]; items are statically bounded to EffortLayer values.
          onValueChange={(next) => onVisibleLayersChange(next as EffortLayer[])}
          aria-label={t("info-map-layers")}
        >
          <ToggleGroupItem
            value="bars"
            aria-label={t("info-effort-bars")}
            className={LEGEND_FILTER}
          >
            <span
              className={cn("size-2.5 shrink-0 rounded-[2px]", SWATCH_ON)}
              style={{ backgroundColor: "var(--chart-1)" }}
            />
            {t("info-effort-bars")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="grounds"
            aria-label={t("info-fishing-grounds")}
            className={LEGEND_FILTER}
          >
            <span className={cn("h-0.5 w-3.5 shrink-0 rounded-full bg-foreground", SWATCH_ON)} />
            {t("info-fishing-grounds")}
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            {t("info-total-visits", { count: stats.totalVisits })} ·{" "}
            {t("info-active-cells", { count: stats.gridCells })}
          </span>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("info-fishing-effort-title")}
                />
              }
            >
              <InfoIcon />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="flex flex-col gap-2 text-sm">
                <p className="font-medium">{t("info-fishing-effort-title")}</p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{t("info-grid-resolution")}</strong>{" "}
                  {t("info-grid-resolution-value", { size })} {t("info-each-cell")}
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{t("info-fishing-grounds")}:</strong>{" "}
                  {t("info-grounds-definition")}
                </p>
                <Separator />
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  <li>{t("info-avg-time", { value: decimal(stats.avgTime) })}</li>
                  <li>{t("info-max-time", { value: decimal(stats.maxTime) })}</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  {t("info-visits-definition")} {t("info-rotate-hint")}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
