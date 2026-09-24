"use client";

import { Checkbox, Input, Popover } from "rizzui";
import { TbFilterCog } from "react-icons/tb";
import { PiCaretDownBold } from "react-icons/pi";
import { ChangeEvent, useEffect, useState, useMemo, useRef } from "react";
import { useSession } from "next-auth/react"
import type { DefaultSession } from 'next-auth';
import find from 'lodash/find';
import get from 'lodash/get';
import values from 'lodash/values';
import isEmpty from 'lodash/isEmpty';
import { useAtom, atom } from 'jotai';
import { atomWithStorage, RESET } from 'jotai/utils';
import Fuse from "fuse.js";
import { MetricKey } from "@/app/shared/file/dashboard/charts/types";

import type { TDistrict } from "@repo/nosql/schema/district";
import SimpleBar from '@ui/simplebar';
import useUserPermissions from "../shared/file/dashboard/hooks/useUserPermissions";
import { useTranslation } from "@/app/i18n/client";
import cn from "@utils/class-names";
import { api } from "@/trpc/react";
import { activeCountry } from "@/config/countryConfig";
import { trackEvent } from "@/lib/analytics";

type DropdownTypes = {
  sectionName: string;
  units: {
    value: string
  }[];
};

type CustomSession = {
  user?: {
    districts?: Omit<TDistrict, "lat" | "lng">[]
  }
}

const sessObjectToDropdown = (session: DefaultSession & CustomSession) => {
  return values(session.user?.districts).reduce((prev: DropdownTypes[], cur: Omit<TDistrict, "lat" | "lng">) => 
    find(prev, { sectionName: cur.region })
    ?
      prev.map((item) => {
        if (item.sectionName === cur.region) {
        return {
            sectionName: cur.region,
            units: [
              ...(get(find(prev, { sectionName: cur.region }), 'units', [])),
              { value: cur.district }
            ]
          } as DropdownTypes        
        }

        return item
      })
    : 
      [
        ...prev,
        {
          sectionName: cur.region,
          units: [
            { value: cur.district }
          ]
        } as DropdownTypes
      ]
  , [])
}

export const dropdownAtom = atomWithStorage<DropdownTypes[]>('dropdown', [], undefined, { getOnInit: true });

// Default district selection comes from countryConfig.defaultSelectedDistricts
const districtsStorageAtom = atomWithStorage<string[]>('districts', activeCountry.defaultSelectedDistricts, undefined, { getOnInit: true });

const KNOWN_DISTRICTS = new Set(activeCountry.districts);

/**
 * The selection is persisted in localStorage, but the district list is
 * country-specific. Without this, a value stored while a different country was
 * active survives forever: every chart then queries district names the current
 * database has never heard of, the query succeeds with an empty result, and the
 * charts render "no data" with no error anywhere to explain why.
 *
 * An empty array is left alone -- that is the user deliberately clearing the
 * filter, not stale state.
 */
function reconcileDistricts(stored: string[]): string[] {
  if (stored.length === 0) return stored;
  const valid = dedupe(stored.filter((d) => KNOWN_DISTRICTS.has(d)));
  return valid.length > 0 ? valid : activeCountry.defaultSelectedDistricts;
}

/**
 * Selecting a partially selected region appends all of its districts, so
 * duplicates used to accumulate in storage. Besides doubling chart legends,
 * they lengthen every query URL until tRPC refuses to send it.
 */
function dedupe(districts: string[]): string[] {
  return Array.from(new Set(districts));
}

export const districtsAtom = atom(
  (get) => reconcileDistricts(get(districtsStorageAtom)),
  (
    _get,
    set,
    update: string[] | ((prev: string[]) => string[]) | typeof RESET
  ) => {
    if (update === RESET) {
      set(districtsStorageAtom, RESET);
      return;
    }
    set(districtsStorageAtom, (prev) =>
      dedupe(typeof update === "function" ? update(prev) : update)
    );
  }
);
export const viewModeAtom = atomWithStorage<'district' | 'region'>('viewMode', 'district', undefined, { getOnInit: true });

// Global metric selector atom
export const selectedMetricAtom = atom<MetricKey>("mean_cpue");

// Revenue-specific metric selector atom
export const selectedRevenueMetricAtom = atom<MetricKey>("estimated_revenue");



export const FilterSelector = () => {
  const { t } = useTranslation("common");
  const [searchFilter, setSearchFilter] = useState("");
  const [filteredList, setFilteredList] = useState<string[]>([]);
  const [fuse, setFuse] = useState<Fuse<string>>();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useAtom(districtsAtom);
  const [viewMode] = useAtom(viewModeAtom);
  const prevValidDistrictsRef = useRef<string[]>([]);

  // Use official district list from countryConfig (single source of truth for UI)
  const validDistricts = useMemo(() => [...activeCountry.districts].sort((a, b) => a.localeCompare(b)), []);

  // Build region-grouped structure from districtToRegion
  const groupedDistricts = useMemo((): DropdownTypes[] => {
    const regions = activeCountry.features.regionBreakdown?.regions
      ?? (Array.from(new Set(Object.values(activeCountry.districtToRegion))).sort() as [string, ...string[]]);
    return regions
      .map(region => ({
        sectionName: region,
        units: validDistricts
          .filter(d => activeCountry.districtToRegion[d] === region)
          .map(d => ({ value: d })),
      }))
      .filter(group => group.units.length > 0);
  }, [validDistricts]);

  useEffect(() => {
    // Only update if the validDistricts array has actually changed
    if (JSON.stringify(prevValidDistrictsRef.current) !== JSON.stringify(validDistricts)) {
      setFilteredList(validDistricts);
      setFuse(new Fuse(validDistricts, { includeScore: true, threshold: 0.3 }));
      prevValidDistrictsRef.current = validDistricts;
    }
  }, [validDistricts]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!fuse) return;
    setSearchFilter(e.target.value);
    if (e.target.value) {
      const result = fuse.search(e.target.value);
      setFilteredList(result.map((res) => res.item));
    } else {
      setFilteredList(validDistricts);
    }
  };

  const selectedCount = selectedDistricts.length;
  const totalCount = validDistricts.length;

  return (
    <Popover isOpen={isOpen} setIsOpen={setIsOpen} placement="bottom-end">
      <Popover.Trigger>
        <button
          className={cn(
            "relative flex items-center gap-1.5 px-2 py-1.5 xs:px-3 xs:py-2 sm:px-4 text-sm font-medium rounded-lg transition-all",
            "border border-blue-200/80 dark:border-blue-600/50",
            "bg-blue-50/50 dark:bg-blue-800/20 text-gray-800 dark:text-gray-700",
            "hover:bg-blue-100/70 dark:hover:bg-blue-700/25 hover:border-blue-300 dark:hover:border-blue-500/60",
            "focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600",
            isOpen && "ring-2 ring-blue-300 dark:ring-blue-600 bg-blue-50 dark:bg-blue-800/30"
          )}
        >
          <TbFilterCog className="h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
          <span className="hidden sm:inline">{t('text-districts') || 'Districts'}</span>
          {selectedCount > 0 && selectedCount < totalCount && (
            <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-xs font-semibold rounded-full bg-blue-200/80 dark:bg-blue-700/60 text-blue-800 dark:text-blue-200">
              {selectedCount}
            </span>
          )}
          <PiCaretDownBold className={cn("h-3 w-3 flex-shrink-0 transition-transform", isOpen && "rotate-180")} />
        </button>
      </Popover.Trigger>
      <Popover.Content className="w-[280px] sm:w-[350px] bg-gray-0 dark:bg-gray-50 border border-muted rounded-lg p-4">
        <div className="mb-2">
          <Input
            placeholder="Search districts..."
            value={searchFilter}
            onChange={handleSearchChange}
            className="mb-2 bg-gray-0 dark:bg-gray-50 text-gray-900 dark:text-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{selectedCount} of {totalCount} districts selected</span>
            {selectedCount > 0 && (
              <button
                className="text-primary hover:text-primary-dark"
                onClick={() => {
                  trackEvent("filter_district_change", {
                    action: "clear",
                    district_count: 0,
                  });
                  setSelectedDistricts([]);
                }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        <SimpleBar className="max-h-[300px] md:max-h-[600px]">
          {searchFilter
            ? filteredList.map((district) => (
                <FilterGroup
                  key={district}
                  districtSection={district}
                  searchFilter={searchFilter}
                  viewMode={viewMode}
                />
              ))
            : groupedDistricts.map((group) => (
                <FilterGroup
                  key={group.sectionName}
                  districtSection={group}
                  searchFilter=""
                  viewMode={viewMode}
                />
              ))
          }
        </SimpleBar>
      </Popover.Content>
    </Popover>
  );
};

const FilterGroup = ({
  districtSection,
  searchFilter,
  viewMode,
}: {
  districtSection: DropdownTypes | string;
  searchFilter: string;
  viewMode?: 'district' | 'region';
}) => {
  const [districts, setDistricts] = useAtom(districtsAtom);
  const { isAdmin } = useUserPermissions();

  const handleDistrictSelect = (unit: string) => {
    if (isAdmin && viewMode === 'region' && typeof districtSection !== 'string') {
      const section = districtSection as DropdownTypes;
      const filteredDistricts = districts.filter(
        district => !section.units.some(u => u.value === district)
      );
      const next = [...filteredDistricts, unit];
      trackEvent("filter_district_change", {
        action: "replace_in_region",
        district: unit,
        district_count: next.length,
      });
      setDistricts(next);
      return;
    }
    const isRemoving = districts.includes(unit);
    const next = isRemoving
      ? districts.filter((d) => d !== unit)
      : [...districts, unit];
    trackEvent("filter_district_change", {
      action: isRemoving ? "remove" : "add",
      district: unit,
      district_count: next.length,
    });
    setDistricts(next);
  };

  if (typeof districtSection === "string" && searchFilter) {
    const unit = districtSection as string;
    return (
      <div className="flex items-center pr-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-100/80 rounded-lg">
        <Checkbox
          key={unit}
          label={<span className="text-gray-900 dark:text-gray-700">{unit}</span>}
          checked={districts.includes(unit)}
          onChange={() => handleDistrictSelect(unit)}
        />
      </div>
    );
  } else {
    const section = districtSection as DropdownTypes;

    const isRegionSelected = isAdmin && viewMode === 'region'
      ? section.units.some(unit => districts.includes(unit.value))
      : section.units.every(unit => districts.includes(unit.value));

    const handleSectionSelect = () => {
      const trackRegion = (next: string[]) =>
        trackEvent("filter_district_change", {
          action: isRegionSelected ? "region_remove" : "region_add",
          peskas_region: section.sectionName,
          district_count: next.length,
        });

      if (isAdmin && viewMode === 'region') {
        if (isRegionSelected) {
          const next = districts.filter(d => !section.units.some(u => u.value === d));
          trackRegion(next);
          setDistricts(next);
        } else {
          const filtered = districts.filter(d => !section.units.some(u => u.value === d));
          const next = [...filtered, section.units[0].value];
          trackRegion(next);
          setDistricts(next);
        }
        return;
      }
      if (isRegionSelected) {
        const next = districts.filter(d => !section.units.map(u => u.value).includes(d));
        trackRegion(next);
        setDistricts(next);
      } else {
        const next = [...districts, ...section.units.map(u => u.value)];
        trackRegion(next);
        setDistricts(next);
      }
    };

    return (
      <div className="border-b border-gray-100 dark:border-gray-200/10 last:border-0 pb-2 mb-2 last:mb-0">
        <div className="flex items-center mb-1">
          <Checkbox
            label={<span className="font-medium text-gray-900 dark:text-gray-700">{section.sectionName}</span>}
            checked={isRegionSelected}
            onChange={handleSectionSelect}
          />
        </div>
        <div className="mt-1 ml-6 space-y-1">
          {section.units.map((unit) => {
            const disabled = isAdmin && viewMode === 'region' && isRegionSelected &&
              !districts.includes(unit.value);
            return (
              <div key={unit.value} className="flex items-center pr-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-100/80 rounded-lg">
                <Checkbox
                  label={<span className="text-gray-900 dark:text-gray-700">{unit.value}</span>}
                  checked={districts.includes(unit.value)}
                  onChange={() => handleDistrictSelect(unit.value)}
                  disabled={disabled}
                  className={disabled ? "opacity-50" : ""}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
};