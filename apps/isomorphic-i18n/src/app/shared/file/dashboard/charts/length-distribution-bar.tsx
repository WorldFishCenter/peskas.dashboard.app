"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";
import { useAtom } from "jotai";
import { districtsAtom } from "@/app/components/filter-selector";
import { selectedTimeRangeAtom } from "@/app/components/time-range-selector";
import dynamic from "next/dynamic";
import WidgetCard from "@components/cards/widget-card";
import { useTranslation } from "@/app/i18n/client";
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@ui/select";
import { Button } from "@ui/button";
import { Popover, ActionIcon } from "rizzui";
import { PiGearSix, PiMagnifyingGlass, PiX, PiInfo } from "react-icons/pi";
import { useTheme } from "next-themes";
import { SPECIES_COLORS } from "./utils";
import cn from "@utils/class-names";

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Format number helper to match other charts
const formatNumber = (value: number, unit: string = "cm") => {
  if (unit === "cm" || unit === "length") {
    return `${value.toFixed(1)} cm`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(1);
};

// Create tooltip HTML without using hooks (hooks can't be used in ApexCharts custom functions)
const createLengthTooltipHTML = (speciesStats: any[], t: any) => {
  return function ({ seriesIndex, dataPointIndex, w }: any) {
    try {
      const species = speciesStats[dataPointIndex];
      if (!species || typeof dataPointIndex !== 'number') return '';

      // Create a mock "payload" structure to match Recharts pattern
      const mockPayload = [
        { name: t('text-mean'), value: species.mean, color: '#4F46E5' },
        { name: t('text-median'), value: species.median, color: '#F59E0B' },
        { name: t('text-q1'), value: species.q1, color: '#10B981' },
        { name: t('text-q3'), value: species.q3, color: '#EF4444' },
        { name: t('text-range'), value: species.max - species.min, color: '#8B5CF6' }
      ].filter(item => item.value && item.value > 0);

      return `
        <div class="bg-gray-0 dark:bg-gray-50 p-3 rounded shadow-lg border border-muted min-w-[200px] text-gray-900 dark:text-gray-700">
          <div class="font-semibold text-gray-900 dark:text-gray-700 mb-2">${species.name || t('text-unknown')}</div>
          ${species.scientific_name ? `<div class="text-xs text-gray-500 dark:text-gray-400 mb-2">${species.scientific_name}</div>` : ''}
          <div class="space-y-1 max-h-40 overflow-y-auto">
            ${mockPayload.map((entry, index) => `
              <div key="tooltip-${entry.name}-${index}" class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full" style="background-color: ${entry.color}"></div>
                  <span class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]">${entry.name}:</span>
                </div>
                <div class="flex items-center gap-2 text-right">
                  <span class="text-xs font-medium text-gray-900 dark:text-gray-700">
                    ${entry.name === t('text-range') ? `${species.min.toFixed(1)} - ${species.max.toFixed(1)} cm` : formatNumber(entry.value, 'cm')}
                  </span>
                </div>
              </div>
            `).join('')}
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background-color: #6B7280"></div>
                <span class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]">${t('text-districts')}:</span>
              </div>
              <div class="flex items-center gap-2 text-right">
                <span class="text-xs font-medium text-gray-900 dark:text-gray-700">${species.districts || 0}</span>
              </div>
            </div>
            ${species.total_catch && species.total_catch > 0 ? `
              <div class="flex items-center justify-between border-t border-muted pt-1 mt-2">
                <span class="text-xs text-gray-500 dark:text-gray-400">${t('text-total-catch')}:</span>
                <span class="text-xs font-medium text-gray-900 dark:text-gray-700">${formatNumber(species.total_catch)} kg</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Tooltip error:', error);
      return `<div class="bg-gray-0 dark:bg-gray-50 p-2 rounded shadow border border-muted">${t('text-error-loading-tooltip')}</div>`;
    }
  };
};

interface LengthDistributionBarProps {
  className?: string;
}

export default function LengthDistributionBar({
  className
}: LengthDistributionBarProps) {
  const { t } = useTranslation("common");
  const { theme } = useTheme();
  const [selectedDistricts] = useAtom(districtsAtom);
  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [isCustomSelection, setIsCustomSelection] = useState(false);
  const [isSpeciesSelectorOpen, setIsSpeciesSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Convert time range to months
  const months = typeof selectedTimeRange === 'number' ? selectedTimeRange : 12;

  // Get all species with length data
  const { data: speciesData, isLoading: isSpeciesLoading, error: speciesError } = api.taxaSummaries.getDistrictTaxaSummaries.useQuery(
    {
      districts: selectedDistricts,
      // STAGE 2 STEP 2.7: Live portal audits confirm only mean_length, catch_kg,
      // and price_kg exist in taxa_summaries; n_individuals was schema-only.
      metrics: ["mean_length", "catch_kg"],
      months,
    },
    {
      enabled: selectedDistricts.length > 0,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    }
  );

  // Get available species for selection
  const availableSpecies = useMemo(() => {
    if (!speciesData) return [];

    // Filter species that have mean_length data and a valid taxon code
    const speciesMap = new Map();
    speciesData.forEach(item => {
      // Now the API returns objects with properties for each metric
      const typedItem = item as any;
      if (
        typedItem.mean_length &&
        typedItem.mean_length > 0 &&
        typeof typedItem.catch_taxon === "string" &&
        typedItem.catch_taxon.trim().length > 0
      ) {
        speciesMap.set(typedItem.catch_taxon, {
          catch_taxon: typedItem.catch_taxon,
          scientific_name: typedItem.scientific_name,
        });
      }
    });

    return Array.from(speciesMap.values()).sort((a, b) =>
      (a.catch_taxon || "").localeCompare(b.catch_taxon || "")
    );
  }, [speciesData]);

  // Set default selected species (top 10) when data loads
  useMemo(() => {
    if (availableSpecies.length > 0 && selectedSpecies.length === 0 && !isCustomSelection) {
      const top10Species = availableSpecies.slice(0, 10).map(s => s.catch_taxon);
      setSelectedSpecies(top10Species);
    }
  }, [availableSpecies, selectedSpecies.length, isCustomSelection]);

  // Handle quick selection presets
  const handleQuickSelect = (count: number | 'all') => {
    setIsCustomSelection(false);
    setSearchQuery("");
    setIsSpeciesSelectorOpen(false);

    if (count === 'all') {
      const allSpecies = availableSpecies.map(s => s.catch_taxon);
      setSelectedSpecies(allSpecies);
    } else {
      const topSpecies = availableSpecies.slice(0, count).map(s => s.catch_taxon);
      setSelectedSpecies(topSpecies);
    }
  };

  // Handle opening custom selector
  const handleOpenCustomSelector = () => {
    setIsCustomSelection(true);
    setIsSpeciesSelectorOpen(true);
    setSearchQuery(""); // Clear any existing search
  };

  // Handle individual species toggle
  const handleSpeciesToggle = (speciesName: string) => {
    setSelectedSpecies(prev =>
      prev.includes(speciesName)
        ? prev.filter(s => s !== speciesName)
        : [...prev, speciesName].slice(0, 15) // Limit to 15 species for performance
    );
  };

  // Filter species based on search query
  const filteredSpecies = useMemo(() => {
    if (!searchQuery) return availableSpecies;
    return availableSpecies.filter(species =>
      species.catch_taxon.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (species.scientific_name && species.scientific_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [availableSpecies, searchQuery]);

  // Prepare ApexCharts boxplot data
  const { chartData, chartOptions } = useMemo(() => {
    if (!speciesData || selectedSpecies.length === 0) {
      return {
        chartData: [],
        chartOptions: {
          chart: { type: 'boxPlot' as const, height: '100%', toolbar: { show: false } },
          xaxis: { type: 'category' as const },
          yaxis: {}
        }
      };
    }

    // Create length distribution data showing variation across districts
    const speciesMap = new Map();

    speciesData.forEach(item => {
      const typedItem = item as any;
      if (selectedSpecies.includes(typedItem.catch_taxon) && typedItem.mean_length && typedItem.mean_length > 0) {
        if (!speciesMap.has(typedItem.catch_taxon)) {
          speciesMap.set(typedItem.catch_taxon, {
            name: typedItem.catch_taxon,
            scientific_name: typedItem.scientific_name,
            lengths: [],
            // STAGE 2 STEP 2.7: Keep only production-backed supporting metrics.
            total_catch: 0,
          });
        }

        const species = speciesMap.get(typedItem.catch_taxon);
        species.lengths.push(typedItem.mean_length);
        // STAGE 2 STEP 2.7: catch_kg is the only additive production-backed
        // supporting quantity used by this chart.
        if (typedItem.catch_kg) species.total_catch += typedItem.catch_kg;
      }
    });

    // Calculate statistics for each species and prepare ApexCharts data
    const speciesStats = Array.from(speciesMap.values())
      .filter(species => species.lengths.length > 0)
      .map(species => {
        const sortedLengths = species.lengths.sort((a: number, b: number) => a - b);
        const mean = sortedLengths.reduce((sum: number, len: number) => sum + len, 0) / sortedLengths.length;
        const min = sortedLengths[0];
        const max = sortedLengths[sortedLengths.length - 1];

        // Calculate quartiles
        const q1Index = Math.floor(sortedLengths.length * 0.25);
        const q3Index = Math.floor(sortedLengths.length * 0.75);
        const medianIndex = Math.floor(sortedLengths.length * 0.5);

        const q1 = sortedLengths[q1Index] || min;
        const q3 = sortedLengths[q3Index] || max;
        const median = sortedLengths[medianIndex] || mean;

        return {
          name: species.name,
          mean: Number(mean.toFixed(1)),
          median: Number(median.toFixed(1)),
          q1: Number(q1.toFixed(1)),
          q3: Number(q3.toFixed(1)),
          min: Number(min.toFixed(1)),
          max: Number(max.toFixed(1)),
          districts: sortedLengths.length,
          scientific_name: species.scientific_name,
          // STAGE 2 STEP 2.7: Do not expose a fabricated/always-zero individuals
          // statistic now that the live contract has been corrected.
          total_catch: species.total_catch,
        };
      })
      .sort((a, b) => b.total_catch - a.total_catch);

    // Prepare ApexCharts boxplot series data
    const chartData = [{
      name: t('text-length-distribution'),
      data: speciesStats.map(species => ({
        x: species.name,
        y: [species.min, species.q1, species.median, species.q3, species.max]
      }))
    }];


    // ApexCharts options with dynamic theming
    const chartOptions = {
      chart: {
        type: 'boxPlot' as const,
        height: '100%',
        toolbar: {
          show: false
        },
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        },
        background: 'transparent'
      },
      plotOptions: {
        bar: {
          horizontal: true
        },
        boxPlot: {
          colors: {
            upper: theme === 'dark' ? '#CA1551' : '#CA1551',
            lower: theme === 'dark' ? '#96ACB7' : '#96ACB7'
          },
          fillOpacity: theme === 'dark' ? 0.9 : 0.75,
          medianColor: theme === 'dark' ? '#FBBF24' : '#1E40AF',
          medianWidth: theme === 'dark' ? 4 : 3,
          whiskerColor: theme === 'dark' ? '#D1D5DB' : '#6B7280',
          whiskerWidth: theme === 'dark' ? 3 : 2,
          outlierColor: theme === 'dark' ? '#F87171' : '#EF4444',
          outlierSize: theme === 'dark' ? 5 : 4,
          showOutliers: true,
          boxWidth: '80%',
          strokeWidth: theme === 'dark' ? 2 : 1,
          strokeColors: theme === 'dark' ? '#E5E7EB' : '#1E293B'
        }
      },
      colors: ['#CA1551'],
      fill: {
        type: 'gradient',
        gradient: {
          shade: theme === 'dark' ? 'dark' : 'light',
          type: 'horizontal',
          shadeIntensity: theme === 'dark' ? 0.3 : 0.15,
          gradientToColors: theme === 'dark' ? ['#96ACB7'] : ['#96ACB7'],
          inverseColors: false,
          opacityFrom: theme === 'dark' ? 0.95 : 0.8,
          opacityTo: theme === 'dark' ? 0.8 : 0.6,
          stops: [0, 100]
        }
      },
      title: {
        text: '',
        show: false
      },
      xaxis: {
        type: 'numeric' as const,
        title: {
          text: t('text-length-cm'),
          style: {
            fontSize: '13px',
            fontWeight: 500,
            color: theme === 'dark' ? '#9CA3AF' : '#64748b'
          }
        },
        labels: {
          style: {
            fontSize: '12px',
            colors: theme === 'dark' ? '#9CA3AF' : '#64748b'
          }
        }
      },
      yaxis: {
        type: 'category' as const,
        labels: {
          style: {
            fontSize: '12px',
            colors: theme === 'dark' ? '#9CA3AF' : '#64748b'
          },
          formatter: (value: number) => {
            const stringValue = String(value);
            if (!stringValue) return stringValue;
            return stringValue.length > 15 ? `${stringValue.slice(0, 15)}...` : stringValue;
          }
        }
      },
      grid: {
        show: true,
        borderColor: theme === 'dark' ? '#6B7280' : '#e5e7eb',
        strokeDashArray: 3,
        position: 'back' as const,
        xaxis: {
          lines: {
            show: true
          }
        },
        yaxis: {
          lines: {
            show: false
          }
        },
        row: {
          colors: ['transparent', theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.02)'],
          opacity: theme === 'dark' ? 0.8 : 0.5
        },
        padding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      },
      tooltip: {
        shared: false,
        custom: createLengthTooltipHTML(speciesStats, t)
      },
      stroke: {
        show: true,
        width: theme === 'dark' ? 2 : 1,
        colors: [theme === 'dark' ? '#E5E7EB' : '#1E293B'],
        lineCap: 'round' as const
      },
      theme: {
        mode: theme === 'dark' ? ('dark' as const) : ('light' as const),
        palette: 'palette1'
      },
      dataLabels: {
        enabled: false
      },
      legend: {
        show: false
      },
      responsive: [{
        breakpoint: 768,
        options: {
          plotOptions: {
            boxPlot: {
              boxWidth: '70%'
            }
          }
        }
      }]
    };

    return { chartData, chartOptions };
  }, [speciesData, selectedSpecies, theme, t]);


  if (isSpeciesLoading) {
    return (
      <WidgetCard
        title={t("text-length-distribution") || "Length Distribution"}
        className={className}
      >
        <div className="h-80 md:h-96 lg:h-[28rem] xl:h-[32rem] flex items-center justify-center animate-pulse">
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </WidgetCard>
    );
  }

  if (speciesError || !speciesData) {
    return (
      <WidgetCard
        title={t("text-length-distribution") || "Length Distribution"}
        className={className}
      >
        <div className="h-80 md:h-96 lg:h-[28rem] xl:h-[32rem] flex flex-col items-center justify-center">
          <p className="text-gray-500">{t('text-no-data-available')}</p>
        </div>
      </WidgetCard>
    );
  }

  if (availableSpecies.length === 0) {
    return (
      <WidgetCard
        title={t("text-length-distribution") || "Length Distribution"}
        className={className}
      >
        <div className="h-80 md:h-96 lg:h-[28rem] xl:h-[32rem] flex flex-col items-center justify-center">
          <p className="text-gray-500">{t('text-no-length-data-available')}</p>
        </div>
      </WidgetCard>
    );
  }

  if (chartData.length === 0) {
    return (
      <WidgetCard
        title={t("text-length-distribution") || "Length Distribution"}
        className={className}
      >
        <div className="h-80 md:h-96 lg:h-[28rem] xl:h-[32rem] flex flex-col items-center justify-center">
          <p className="text-gray-500">{t('text-select-species-to-view')}</p>
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={
        <div className="flex flex-row items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-700">
              {t("text-length-distribution") || "Length Distribution"}
            </span>

            {/* Info Icon */}
            <div className="relative group">
              <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                <PiInfo className="h-4 w-4" />
              </button>

              {/* Hover Tooltip */}
              <div className="absolute left-0 top-6 w-80 p-4 bg-gray-0/90 dark:bg-gray-50/90 backdrop-blur-sm rounded-lg shadow-lg border border-muted/70 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 ease-out transform translate-y-2 group-hover:translate-y-0">
                <div className="space-y-3">
                  <div className="font-semibold text-gray-900 dark:text-gray-700 text-sm">
                    {t('text-about-length-distribution')}
                  </div>
                  <div className="text-sm text-gray-900 dark:text-gray-700 space-y-2">
                    <p>
                      {t('text-length-distribution-description')}
                    </p>
                    <p>
                      <strong>{t('text-species-ranking')}</strong> {t('text-species-ranking-description')}
                    </p>
                    <p>
                      <strong>{t('text-box-elements')}</strong>
                    </p>
                    <ul className="text-xs space-y-1 ml-3">
                      <li>• <strong>{t('text-box-element-box')}</strong> {t('text-box-element-box-description')}</li>
                      <li>• <strong>{t('text-box-element-median')}</strong> {t('text-box-element-median-description')}</li>
                      <li>• <strong>{t('text-box-element-whiskers')}</strong> {t('text-box-element-whiskers-description')}</li>
                      <li>• <strong>{t('text-box-element-dots')}</strong> {t('text-box-element-dots-description')}</li>
                    </ul>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('text-length-distribution-summary')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Natural Species Selection */}
          <Popover
            isOpen={isSpeciesSelectorOpen}
            setIsOpen={setIsSpeciesSelectorOpen}
            placement="bottom-end"
          >
            <Popover.Trigger>
              <button
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-muted bg-gray-0 dark:bg-gray-50 text-gray-900 dark:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-100/80 focus:ring-2 focus:ring-blue-200 min-w-[160px] justify-between"
              >
                <span>
                  {isCustomSelection
                    ? `${selectedSpecies.length} ${t('text-species-selected')}`
                    : t('text-top-species', { count: selectedSpecies.length })
                  }
                </span>
                <PiGearSix className="h-3 w-3 flex-shrink-0" />
              </button>
            </Popover.Trigger>
            <Popover.Content className="w-72 p-0 bg-gray-0 dark:bg-gray-50 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600">
              {/* Quick Presets - only show when not in custom mode */}
              {!isCustomSelection && (
                <div className="p-2">
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-900 px-2 py-1 mb-1">
                      {t('text-quick-selection')}
                    </div>
                    <div className="space-y-0.5">
                      <button
                        onClick={() => handleQuickSelect(3)}
                        className={cn(
                          "w-full px-2 py-1.5 text-left text-sm rounded transition-colors",
                          selectedSpecies.length === 3
                            ? "bg-blue-50 dark:bg-blue-800 text-blue-900 dark:text-blue-200"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                      >
                        {t('text-top-3')}
                      </button>
                      <button
                        onClick={() => handleQuickSelect(5)}
                        className={cn(
                          "w-full px-2 py-1.5 text-left text-sm rounded transition-colors",
                          selectedSpecies.length === 5
                            ? "bg-blue-50 dark:bg-blue-800 text-blue-900 dark:text-blue-200"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        {t('text-top-5')}
                      </button>
                      <button
                        onClick={() => handleQuickSelect(8)}
                        className={cn(
                          "w-full px-2 py-1.5 text-left text-sm rounded transition-colors",
                          selectedSpecies.length === 8
                            ? "bg-blue-50 dark:bg-blue-800 text-blue-900 dark:text-blue-200"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        {t('text-top-8')}
                      </button>
                      <button
                        onClick={() => handleQuickSelect(10)}
                        className={cn(
                          "w-full px-2 py-1.5 text-left text-sm rounded transition-colors",
                          selectedSpecies.length === 10
                            ? "bg-blue-50 dark:bg-blue-800 text-blue-900 dark:text-blue-200"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        {t('text-top-10')}
                      </button>
                      <button
                        onClick={() => handleQuickSelect('all')}
                        className={cn(
                          "w-full px-2 py-1.5 text-left text-sm rounded transition-colors",
                          selectedSpecies.length === availableSpecies.length
                            ? "bg-blue-50 dark:bg-blue-800 text-blue-900 dark:text-blue-200"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        {t('text-all')}
                      </button>
                      {/* Separator for Custom button */}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                      <button
                        onClick={handleOpenCustomSelector}
                        className="w-full px-2 py-1.5 text-left text-sm rounded transition-colors text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium flex items-center gap-2"
                      >
                        <PiGearSix className="h-3 w-3" />
                        {t('text-custom-selection')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Selection Interface */}
              {isCustomSelection && (
                <>
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-gray-900 px-2 py-1">
                        {t('text-choose-species', { selected: selectedSpecies.length })}
                      </div>
                      <button
                        onClick={() => setIsCustomSelection(false)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded transition-colors"
                      >
                        {t('text-back')}
                      </button>
                    </div>
                    <div className="relative">
                      <PiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <input
                        type="text"
                        placeholder={t('text-search-by-name')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border border-muted rounded-md bg-gray-0 dark:bg-gray-50 text-gray-900 dark:text-gray-700"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          <PiX className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />
                        </button>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setSelectedSpecies(filteredSpecies.slice(0, 5).map(s => s.catch_taxon))}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 rounded transition-colors"
                      >
                        {t('text-select-top-5')}
                      </button>
                      {selectedSpecies.length > 0 && (
                        <button
                          onClick={() => setSelectedSpecies([])}
                          className="text-xs text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 rounded transition-colors"
                        >
                          {t('text-clear-all')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Species List */}
                  <div className="max-h-48 overflow-y-auto">
                    {filteredSpecies.length === 0 ? (
                      <div className="p-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                        {searchQuery ? t('text-no-species-found') : availableSpecies.length === 0 ? t('text-no-species-available') : t('text-loading-species')}
                        {availableSpecies.length > 0 && !searchQuery && (
                          <div className="text-xs mt-1">
                            {t('text-available-species', { count: availableSpecies.length })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 space-y-0.5">
                        {filteredSpecies.map((species) => (
                          <label
                            key={species.catch_taxon}
                            className="flex items-center space-x-2 px-2 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSpecies.includes(species.catch_taxon)}
                              onChange={() => handleSpeciesToggle(species.catch_taxon)}
                              disabled={!selectedSpecies.includes(species.catch_taxon) && selectedSpecies.length >= 15}
                              className="h-4 w-4 text-blue-600 bg-gray-0 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 dark:bg-gray-700 dark:border-gray-500 dark:text-blue-400 dark:focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {species.catch_taxon}
                              </div>
                              {species.scientific_name && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 italic truncate">
                                  {species.scientific_name}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                        {selectedSpecies.length >= 15 && (
                          <div className="px-2 py-2 text-xs text-center text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-900/20 rounded mx-2">
                            {t('text-maximum-species-selected')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </Popover.Content>
          </Popover>
        </div>
      }
      className={`border border-muted bg-gray-0 p-5 dark:bg-gray-50 rounded-lg${className ? ` ${className}` : ''}`}
    >
      <div className="h-80 md:h-96 lg:h-[28rem] xl:h-[32rem] w-full">
        {chartData.length > 0 ? (
          <Chart
            options={chartOptions}
            series={chartData}
            type="boxPlot"
            height="100%"
            width="100%"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">{t('text-no-species-selected')}</p>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}