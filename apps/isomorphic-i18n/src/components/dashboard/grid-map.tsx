import { useCallback, useMemo, useState } from "react";
import { GridLayer } from "@deck.gl/aggregation-layers";
import { GeoJsonLayer } from "@deck.gl/layers";
import { DeckGL } from "@deck.gl/react";
import { AttributionControl, Map as MapGL } from "react-map-gl";
import { MapIcon, SatelliteIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { useT } from "@/i18n/use-lang";
import { EffortToolbar, MetricLegend } from "@/components/dashboard/grid-map-controls";
import { useTheme } from "@/components/theme-provider";
import { activeCountry } from "@/config/countryConfig";
import { pages } from "@/config/routes";
import { trackEvent } from "@/lib/analytics";
import { formatNumber } from "@/lib/dashboard/format";
import { metricTitle } from "@/lib/dashboard/metrics";
import {
  CHOROPLETH_COLORS,
  forTheme,
  getColorForValue,
  interpolateChoroplethColor,
  isInBreak,
  MAP_STYLES,
} from "@/lib/grid-map/colors";
import { COLOR_RANGE, GRID_LAYER_SETTINGS, TIME_BREAKS } from "@/lib/grid-map/config";
import type { ChoroplethLegend, DataPoint } from "@/lib/grid-map/types";
import { usePageMetric, useScope } from "@/store/filters";
import { api } from "@/trpc/react";

import "mapbox-gl/dist/mapbox-gl.css";

type Rgba = [number, number, number, number];

const ALL_RANGE_LABELS = TIME_BREAKS.map((r) => r.label);

// deck.gl renders tooltips as a plain DOM node, so style it with the theme tokens
// (its translucent background is the popup rule in globals.css).
const TOOLTIP_STYLE = {
  color: "var(--popover-foreground)",
  fontSize: "12px",
  borderRadius: "calc(var(--radius) * 0.8)",
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.15)",
  padding: "8px 10px",
};

/** deck.gl tooltips take HTML: names and texts from the data go in escaped. */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Grid cell size for a zoom level: about 4 px on screen and never below 500 m,
 * a few of the data's hexagons, so the grid still shows across Mozambique's
 * 2,500 km of coast. A cell is coloured by its busiest hexagon.
 */
function cellSizeFor(zoom: number, latitude: number) {
  const metresPerPixel = (156543.03 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return (
    [500, 1000, 2000, 5000, 10000, 20000, 50000].find((size) => size >= 4 * metresPerPixel) ?? 50000
  );
}

/**
 * The country's map, `className` setting its height. "districts" colours each
 * district by the home page's measure over the time range; "effort" draws the
 * coasts portal's fishing effort (all time), its cells as a grid over the
 * fishing grounds they form, and the district outlines. One question per map.
 */
export function GridMap({ mode, className }: { mode: "districts" | "effort"; className?: string }) {
  const { t, lang } = useT();
  const isDark = useTheme().theme === "dark";
  const [metric] = usePageMetric(pages.home.metric);
  const { months } = useScope();
  const [hovered, setHovered] = useState<string | null>(null);

  const { data: cells = [] } = api.fishingEffort.cells.useQuery(undefined, {
    enabled: mode === "effort",
  });
  const { data: grounds } = api.fishingEffort.grounds.useQuery(undefined, {
    enabled: mode === "effort",
  });
  const { data: boundaries } = api.gaul2Boundaries.getByCountry.useQuery();
  const { data: districtMetrics = [] } = api.summaries.byDistrict.useQuery(
    { months },
    { enabled: mode === "districts" },
  );

  const points: DataPoint[] = useMemo(
    () =>
      cells.map((d) => ({
        position: [d.lng, d.lat] as [number, number],
        avgTimeHours: d.avg_hours_per_day,
        totalVisits: d.unique_trips,
      })),
    [cells],
  );

  const cellColors = useMemo(() => forTheme(COLOR_RANGE, isDark), [isDark]);
  const choropleth = useMemo(() => forTheme(CHOROPLETH_COLORS, isDark), [isDark]);
  const { latitude, zoom: initialZoom } = activeCountry.gridMapViewState;
  const [zoom, setZoom] = useState(initialZoom);
  const cellSize = cellSizeFor(zoom, latitude);

  const metricByDistrict = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of districtMetrics) {
      const v = row[metric];
      if (v !== null) map.set(row.district, v);
    }
    return map;
  }, [districtMetrics, metric]);

  const [minVal, maxVal] = useMemo(() => {
    const vals = Array.from(metricByDistrict.values());
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 1];
  }, [metricByDistrict]);

  const choroplethLegend = useMemo((): ChoroplethLegend | undefined => {
    if (mode !== "districts" || !boundaries || metricByDistrict.size === 0) return undefined;
    return {
      colors: choropleth,
      metricLabel: metricTitle(t, metric),
      minLabel: formatNumber(minVal, lang),
      maxLabel: formatNumber(maxVal, lang),
    };
  }, [mode, boundaries, metricByDistrict, metric, minVal, maxVal, lang, t, choropleth]);

  // Effort ranges shown on the grid; at least one always stays selected.
  const [selectedLabels, setSelectedLabels] = useState<string[]>(ALL_RANGE_LABELS);
  const handleRangesChange = useCallback(
    (next: string[]) => {
      if (next.length === 0) return;
      const toggled =
        next.find((l) => !selectedLabels.includes(l)) ??
        selectedLabels.find((l) => !next.includes(l));
      if (toggled) {
        trackEvent("map_effort_range_toggle", {
          effort_range: toggled,
          enabled: next.includes(toggled),
        });
      }
      setSelectedLabels(next);
    },
    [selectedLabels],
  );

  const visiblePoints = useMemo(() => {
    const ranges = TIME_BREAKS.filter((r) => selectedLabels.includes(r.label));
    return points.filter((d) => ranges.some((r) => isInBreak(d.avgTimeHours, r)));
  }, [points, selectedLabels]);

  const getTooltip = useCallback(
    ({ object, layer }: { object?: any; layer?: { id: string } | null }) => {
      if (!object) return null;

      if (layer?.id === "districts" && object.properties?.district) {
        const name = object.properties.district as string;
        if (mode === "effort")
          return { html: `<strong>${esc(name)}</strong>`, style: TOOLTIP_STYLE };
        const val = metricByDistrict.get(name);
        const detail =
          val != null ? `${metricTitle(t, metric)}: ${formatNumber(val, lang)}` : t("text-no-data");
        return {
          html: `<strong>${esc(name)}</strong><div>${esc(detail)}</div>`,
          style: TOOLTIP_STYLE,
        };
      }

      if (layer?.id === "grounds") {
        const { avg_hours_per_day, unique_trips } = object.properties;
        const avg = avg_hours_per_day.toLocaleString(lang, { maximumFractionDigits: 2 });
        return {
          html: `
            <strong>${esc(t("info-fishing-ground"))}</strong>
            <div>${esc(t("info-avg-time", { value: avg }))}</div>
            <div>${esc(t("info-total-visits", { count: unique_trips }))}</div>`,
          style: TOOLTIP_STYLE,
        };
      }

      if (!object.points) return null;
      const cellPoints = object.points as { source: DataPoint }[];
      const avgTime =
        cellPoints.reduce((sum, p) => sum + p.source.avgTimeHours, 0) / cellPoints.length;
      const totalVisits = cellPoints.reduce((sum, p) => sum + p.source.totalVisits, 0);
      const swatch = `rgb(${cellColors[getColorForValue(avgTime)].join(",")})`;
      const avg = avgTime.toLocaleString(lang, { maximumFractionDigits: 2 });
      return {
        html: `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="width:10px;height:10px;border-radius:2px;background:${swatch}"></span>
            <strong>${esc(t("info-average-time-spent"))}</strong>
          </div>
          <div>${esc(t("info-avg-time", { value: avg }))}</div>
          <div>${esc(t("info-total-visits", { count: totalVisits }))}</div>`,
        style: TOOLTIP_STYLE,
      };
    },
    [mode, metricByDistrict, metric, lang, t, cellColors],
  );

  const layers = useMemo(() => {
    const outline: Rgba = isDark ? [255, 255, 255, 110] : [68, 64, 60, 110];
    const districts =
      boundaries &&
      new GeoJsonLayer({
        id: "districts",
        data: boundaries as any,
        pickable: true,
        stroked: true,
        filled: mode === "districts",
        onHover: (info) => setHovered(info.object?.properties?.district ?? null),
        getFillColor: (f: any): Rgba => {
          const name = f.properties?.district as string | undefined;
          const val = name != null ? metricByDistrict.get(name) : undefined;
          const base: Rgba =
            val != null
              ? interpolateChoroplethColor(val, minVal, maxVal, choropleth)
              : [200, 200, 200, 120];
          if (!hovered) return base;
          return [base[0], base[1], base[2], hovered === name ? 255 : 80];
        },
        getLineColor: (f: any): Rgba =>
          hovered === f.properties?.district
            ? [255, 255, 255, 255]
            : mode === "effort"
              ? outline
              : [255, 255, 255, 200],
        getLineWidth: (f: any) => (hovered === f.properties?.district ? 3 : 1),
        lineWidthUnits: "pixels",
        // Draw on top of the extruded grid.
        parameters: { depthTest: false },
        updateTriggers: {
          getFillColor: [metricByDistrict, minVal, maxVal, hovered, isDark],
          getLineColor: [hovered, mode, isDark],
          getLineWidth: [hovered],
        },
      });
    if (mode === "districts") return districts ? [districts] : [];

    // The grounds are made of the grid's own cells, so only their outline shows over it.
    const fishingGrounds = new GeoJsonLayer({
      id: "grounds",
      data: (grounds?.features ?? []) as any,
      pickable: true,
      filled: false,
      getLineColor: isDark ? [250, 250, 249, 180] : [12, 10, 9, 180],
      getLineWidth: 1,
      lineWidthUnits: "pixels",
      parameters: { depthTest: false },
      updateTriggers: { getLineColor: [isDark] },
    });

    const grid = new GridLayer<DataPoint>({
      ...GRID_LAYER_SETTINGS,
      id: "grid-layer",
      data: visiblePoints,
      cellSize,
      pickable: true,
      extruded: true,
      getPosition: (d) => d.position,
      getElevationWeight: (d) => d.avgTimeHours,
      colorRange: cellColors,
      // Each band's index, on a fixed scale: hiding a band doesn't recolour the others.
      colorScaleType: "quantize",
      colorDomain: [0, COLOR_RANGE.length],
      colorAggregation: "MAX",
      getColorWeight: (d) => getColorForValue(d.avgTimeHours) + 0.5,
      updateTriggers: { getColorWeight: [selectedLabels] },
    });
    return districts ? [grid, fishingGrounds, districts] : [grid, fishingGrounds];
  }, [
    mode,
    isDark,
    visiblePoints,
    grounds,
    cellSize,
    cellColors,
    choropleth,
    selectedLabels,
    boundaries,
    metricByDistrict,
    minVal,
    maxVal,
    hovered,
  ]);

  // Satellite is a raster style billed per tile, so the vector basemap is the default.
  const [basemap, setBasemap] = useState<"map" | "satellite">("map");
  const nextBasemap = basemap === "satellite" ? "map" : "satellite";
  const basemapLabel = t(
    nextBasemap === "map" ? "text-switch-to-map-view" : "text-switch-to-satellite-view",
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg">
        <DeckGL
          initialViewState={activeCountry.gridMapViewState}
          controller
          layers={layers}
          getTooltip={getTooltip as any}
          // Half-zoom steps are enough to resize the grid cells; finer would re-aggregate on every frame.
          onViewStateChange={({ viewState }) => {
            const next = Math.round((viewState as { zoom: number }).zoom * 2) / 2;
            if (next !== zoom) setZoom(next);
          }}
        >
          <MapGL
            mapStyle={
              basemap === "satellite"
                ? MAP_STYLES.satellite
                : isDark
                  ? MAP_STYLES.dark
                  : MAP_STYLES.light
            }
            mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN ?? ""}
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
                className="absolute top-3 right-3 print:hidden"
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
        {choroplethLegend && (
          <MetricLegend legend={choroplethLegend} className="absolute top-3 left-3" />
        )}
      </div>
      {mode === "effort" && (
        <EffortToolbar
          data={visiblePoints}
          colors={cellColors}
          selectedLabels={selectedLabels}
          onSelectedLabelsChange={handleRangesChange}
        />
      )}
    </div>
  );
}
