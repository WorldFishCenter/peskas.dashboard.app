"use client";

import { useCallback, useMemo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useTheme } from "next-themes";
import { GridLayer } from "@deck.gl/aggregation-layers";
import { GeoJsonLayer } from "@deck.gl/layers";
import { DeckGL } from "@deck.gl/react";
import { AttributionControl, Map as MapGL } from "react-map-gl";
import { MapIcon, SatelliteIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { useT } from "@/app/i18n/use-lang";
import { EffortToolbar, MetricLegend } from "@/components/dashboard/grid-map-controls";
import { activeCountry } from "@/config/countryConfig";
import { trackEvent } from "@/lib/analytics";
import { formatDashboardNumber } from "@/lib/dashboard/format";
import { metricTitle } from "@/lib/dashboard/metrics";
import {
  CHOROPLETH_COLORS,
  getColorForValue,
  interpolateChoroplethColor,
  isInBreak,
  MAP_STYLES,
} from "@/lib/grid-map/colors";
import { COLOR_RANGE, GRID_LAYER_SETTINGS, TIME_BREAKS } from "@/lib/grid-map/config";
import type { ChoroplethLegend, DataPoint } from "@/lib/grid-map/types";
import { hoveredDistrictAtom } from "@/store/dashboard";
import { selectedMetricAtom } from "@/store/filters";
import { dateRangeAtom } from "@/store/time-range";
import { api } from "@/trpc/react";

import "mapbox-gl/dist/mapbox-gl.css";

type Rgba = [number, number, number, number];

const ALL_RANGE_LABELS = TIME_BREAKS.map((r) => r.label);

// deck.gl renders tooltips as a plain DOM node, so style it with the theme tokens.
const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: "12px",
  borderRadius: "calc(var(--radius) * 0.8)",
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.15)",
  padding: "8px 10px",
};

/** Effort grid over district boundaries coloured by the selected metric; `className` sets its height. */
export function GridMap({ className }: { className?: string }) {
  const { t, lang } = useT();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const metric = useAtomValue(selectedMetricAtom);
  const { start, end } = useAtomValue(dateRangeAtom);
  const [hoveredDistrict, setHoveredDistrict] = useAtom(hoveredDistrictAtom);

  const { data: gridData = [] } = api.gridSummary.all.useQuery();
  const { data: boundaries } = api.gaul2Boundaries.getByCountry.useQuery({ iso3Code: activeCountry.iso3Code });
  const { data: districtMetrics = [] } = api.districtSummary.getDistrictsSummaryByDateRange.useQuery({
    startDate: start,
    endDate: end,
  });

  const points: DataPoint[] = useMemo(
    () =>
      (gridData as any[])
        .filter((d) => !d.type?.includes("metadata"))
        .map((d) => ({
          position: [d.lng_grid_1km, d.lat_grid_1km] as [number, number],
          avgTimeHours: d.avg_time_hours || 0,
          totalVisits: parseInt(d.total_visits) || 0,
          avgSpeed: parseFloat(d.avg_speed) || 0,
        })),
    [gridData]
  );

  const metricByDistrict = useMemo(() => {
    const map = new Map<string, number>();
    (districtMetrics as any[]).forEach((row) => {
      const v = row[metric];
      if (v != null && !isNaN(Number(v))) map.set(row.gaul_2_name, Number(v));
    });
    return map;
  }, [districtMetrics, metric]);

  const [minVal, maxVal] = useMemo(() => {
    const vals = Array.from(metricByDistrict.values());
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 1];
  }, [metricByDistrict]);

  const choroplethLegend = useMemo((): ChoroplethLegend | undefined => {
    if (!boundaries || metricByDistrict.size === 0) return undefined;
    return {
      colors: CHOROPLETH_COLORS,
      metricLabel: metricTitle(t, metric),
      minLabel: formatDashboardNumber(minVal, metric, lang),
      maxLabel: formatDashboardNumber(maxVal, metric, lang),
    };
  }, [boundaries, metricByDistrict, metric, minVal, maxVal, lang, t]);

  // Effort ranges shown on the grid; at least one always stays selected.
  const [selectedLabels, setSelectedLabels] = useState<string[]>(ALL_RANGE_LABELS);
  const handleRangesChange = useCallback(
    (next: string[]) => {
      if (next.length === 0) return;
      const toggled =
        next.find((l) => !selectedLabels.includes(l)) ?? selectedLabels.find((l) => !next.includes(l));
      if (toggled) {
        trackEvent("map_effort_range_toggle", { effort_range: toggled, enabled: next.includes(toggled) });
      }
      setSelectedLabels(next);
    },
    [selectedLabels]
  );

  const visiblePoints = useMemo(() => {
    const ranges = TIME_BREAKS.filter((r) => selectedLabels.includes(r.label));
    return points.filter((d) => ranges.some((r) => isInBreak(d.avgTimeHours, r)));
  }, [points, selectedLabels]);

  const getTooltip = useCallback(
    ({ object, layer }: { object?: any; layer?: { id: string } | null }) => {
      if (!object) return null;

      if (layer?.id === "gaul2-choropleth" && object.properties?.gaul2_name) {
        const name = object.properties.gaul2_name as string;
        const val = metricByDistrict.get(name);
        const detail =
          val != null ? `${metricTitle(t, metric)}: ${formatDashboardNumber(val, metric, lang)}` : t("text-no-data");
        return { html: `<strong>${name}</strong><div>${detail}</div>`, style: TOOLTIP_STYLE };
      }

      if (!object.points) return null;
      const cellPoints = object.points as { source: DataPoint }[];
      const avgTime = cellPoints.reduce((sum, p) => sum + p.source.avgTimeHours, 0) / cellPoints.length;
      const totalVisits = cellPoints.reduce((sum, p) => sum + p.source.totalVisits, 0);
      const swatch = `rgb(${COLOR_RANGE[getColorForValue(avgTime)].join(",")})`;
      const avg = avgTime.toLocaleString(lang, { maximumFractionDigits: 2 });
      return {
        html: `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="width:10px;height:10px;border-radius:2px;background:${swatch}"></span>
            <strong>${t("info-average-time-spent")}</strong>
          </div>
          <div>${t("info-avg-time", { value: avg })}</div>
          <div>${t("info-total-visits", { count: totalVisits })}</div>`,
        style: TOOLTIP_STYLE,
      };
    },
    [metricByDistrict, metric, lang, t]
  );

  const layers = useMemo(() => {
    const grid = new GridLayer<DataPoint>({
      ...GRID_LAYER_SETTINGS,
      id: "grid-layer",
      data: visiblePoints,
      pickable: true,
      extruded: true,
      getPosition: (d) => d.position,
      getElevationWeight: (d) => d.avgTimeHours,
      colorRange: COLOR_RANGE,
      colorScaleType: "ordinal",
      getColorWeight: (d) => getColorForValue(d.avgTimeHours),
      updateTriggers: { getColorWeight: [selectedLabels] },
    });
    if (!boundaries) return [grid];

    const choropleth = new GeoJsonLayer({
      id: "gaul2-choropleth",
      data: boundaries as any,
      pickable: true,
      stroked: true,
      filled: true,
      onHover: (info) => setHoveredDistrict(info.object?.properties?.gaul2_name ?? null),
      getFillColor: (f: any): Rgba => {
        const name = f.properties?.gaul2_name as string | undefined;
        const val = name != null ? metricByDistrict.get(name) : undefined;
        const base: Rgba = val != null ? interpolateChoroplethColor(val, minVal, maxVal) : [200, 200, 200, 120];
        if (!hoveredDistrict) return base;
        return [base[0], base[1], base[2], hoveredDistrict === name ? 255 : 80];
      },
      getLineColor: (f: any): Rgba =>
        hoveredDistrict === f.properties?.gaul2_name ? [255, 255, 255, 255] : [255, 255, 255, 200],
      getLineWidth: (f: any) => (hoveredDistrict === f.properties?.gaul2_name ? 3 : 1),
      lineWidthUnits: "pixels",
      // Draw on top of the extruded grid.
      parameters: { depthTest: false },
      updateTriggers: {
        getFillColor: [metricByDistrict, minVal, maxVal, hoveredDistrict],
        getLineColor: [hoveredDistrict],
        getLineWidth: [hoveredDistrict],
      },
    });
    return [grid, choropleth];
  }, [visiblePoints, selectedLabels, boundaries, metricByDistrict, minVal, maxVal, hoveredDistrict, setHoveredDistrict]);

  // Satellite is a raster style billed per tile, so the vector basemap is the default.
  const [basemap, setBasemap] = useState<"map" | "satellite">("map");
  const nextBasemap = basemap === "satellite" ? "map" : "satellite";
  const basemapLabel = t(nextBasemap === "map" ? "text-switch-to-map-view" : "text-switch-to-satellite-view");

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg">
        <DeckGL
          initialViewState={activeCountry.gridMapViewState}
          controller
          layers={layers}
          getTooltip={getTooltip as any}
        >
          <MapGL
            mapStyle={basemap === "satellite" ? MAP_STYLES.satellite : isDark ? MAP_STYLES.dark : MAP_STYLES.light}
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
            // Mapbox GL v3 defaults to the globe projection, which curves the basemap
            // at low zoom while deck.gl keeps rendering Web Mercator: the boundary and
            // grid layers visibly detach from the basemap. Pin mercator so both agree.
            projection={{ name: "mercator" }}
            reuseMaps
            attributionControl={false}
            renderWorldCopies={false}
            antialias
          >
            <AttributionControl compact />
          </MapGL>
        </DeckGL>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label={basemapLabel}
                className="absolute top-3 right-3"
                onClick={() => {
                  trackEvent("map_basemap_change", { basemap: nextBasemap });
                  setBasemap(nextBasemap);
                }}
              />
            }
          >
            {basemap === "satellite" ? <MapIcon /> : <SatelliteIcon />}
          </TooltipTrigger>
          <TooltipContent>{basemapLabel}</TooltipContent>
        </Tooltip>
        {/* Top-left: the Mapbox wordmark and attribution own the bottom corners. */}
        {choroplethLegend && <MetricLegend legend={choroplethLegend} className="absolute top-3 left-3" />}
      </div>
      <EffortToolbar data={visiblePoints} selectedLabels={selectedLabels} onSelectedLabelsChange={handleRangesChange} />
    </div>
  );
}
