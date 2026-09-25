import { atom } from 'jotai';
import { computeDateRange } from '@/lib/dashboard/format';

export type TimeRange = 3 | 6 | 12 | 'all';

export const TIME_RANGE_OPTIONS: { value: TimeRange; labelKey: string }[] = [
  { value: 3, labelKey: 'text-last-3-months' },
  { value: 6, labelKey: 'text-last-6-months' },
  { value: 12, labelKey: 'text-last-year' },
  { value: 'all', labelKey: 'text-all-time' },
];

export const selectedTimeRangeAtom = atom<TimeRange>(6);

/** Month count for the monthly endpoints; undefined means "all time". */
export const monthsAtom = atom((get) => {
  const range = get(selectedTimeRangeAtom);
  return typeof range === 'number' ? range : undefined;
});

/** One day-rounded window shared by every date-range query. */
export const dateRangeAtom = atom((get) => computeDateRange(get(selectedTimeRangeAtom)));
