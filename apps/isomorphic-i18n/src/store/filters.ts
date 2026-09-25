import { atom } from 'jotai';
import { atomWithStorage, RESET } from 'jotai/utils';
import { activeCountry } from '@/config/countryConfig';
import type { MetricKey } from '@repo/domain/metrics';

// Default district selection comes from countryConfig.defaultSelectedDistricts
const districtsStorageAtom = atomWithStorage<string[]>(
  'districts',
  activeCountry.defaultSelectedDistricts,
  undefined,
  { getOnInit: true }
);

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
  (_get, set, update: string[] | ((prev: string[]) => string[]) | typeof RESET) => {
    if (update === RESET) {
      set(districtsStorageAtom, RESET);
      return;
    }
    set(districtsStorageAtom, (prev) => dedupe(typeof update === 'function' ? update(prev) : update));
  }
);

// Metric shown on /catch and by the home district widget.
export const selectedMetricAtom = atom<MetricKey>('mean_cpue');

// Metric shown on /revenue.
export const selectedRevenueMetricAtom = atom<MetricKey>('estimated_revenue');
