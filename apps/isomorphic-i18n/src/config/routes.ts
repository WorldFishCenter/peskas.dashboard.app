import type { ComponentType } from 'react';
import { atom, type PrimitiveAtom } from 'jotai';
import { ChartPieIcon, CircleDollarSignIcon, FishIcon, HouseIcon, InfoIcon, type LucideIcon } from 'lucide-react';
import type { MetricKey } from '@repo/domain/metrics';
import { useAppRoute } from '@/i18n/use-lang';

/** The metric an analysis page charts: the viewer's choice, the choices offered, and the gear treemap's metric. */
export type PageMetric = { atom: PrimitiveAtom<MetricKey>; options: MetricKey[]; gear: MetricKey };

export type Page = {
  /** Path under `/:lang`. */
  path: string;
  titleKey: string;
  nav?: { labelKey: string; icon: LucideIcon; beta?: true };
  /** Header filters: the time range, and the district selection (see CONTEXT.md). */
  timeRange?: true;
  districts?: true;
  /** A metric picker in the header. Each page keeps its own choice. */
  metric?: PageMetric;
  load: () => Promise<{ default: ComponentType }>;
};

/**
 * Every page, in nav order. The router, the nav, the header title and the
 * header filters all read this table, so a new page is one entry, its page
 * file and its locale keys.
 */
export const pages = {
  home: {
    path: '/',
    titleKey: 'text-home',
    nav: { labelKey: 'text-home', icon: HouseIcon },
    timeRange: true,
    load: () => import('@/pages/home'),
  },
  catch: {
    path: '/catch',
    titleKey: 'text-catch-analysis',
    nav: { labelKey: 'nav-catch', icon: FishIcon },
    timeRange: true,
    districts: true,
    metric: { atom: atom<MetricKey>('mean_cpue'), options: ['mean_cpue', 'estimated_catch_tn'], gear: 'mean_cpue' },
    load: () => import('@/pages/catch'),
  },
  revenue: {
    path: '/revenue',
    titleKey: 'text-revenue-analysis',
    nav: { labelKey: 'nav-revenue', icon: CircleDollarSignIcon },
    timeRange: true,
    districts: true,
    metric: {
      atom: atom<MetricKey>('estimated_revenue'),
      options: ['mean_rpue', 'estimated_revenue'],
      gear: 'mean_rpue',
    },
    load: () => import('@/pages/revenue'),
  },
  catchComposition: {
    path: '/catch_composition',
    titleKey: 'text-catch-composition-analysis',
    nav: { labelKey: 'nav-catch-composition', icon: ChartPieIcon, beta: true },
    timeRange: true,
    districts: true,
    load: () => import('@/pages/catch-composition'),
  },
  about: {
    path: '/about',
    titleKey: 'nav-about',
    nav: { labelKey: 'nav-about', icon: InfoIcon, beta: true },
    load: () => import('@/pages/about'),
  },
} satisfies Record<string, Page>;

/** The table as a list, in nav order. */
export const allPages: Page[] = Object.values(pages);

/** The table entry for the current path; undefined on a path with no page (not found). */
export function useCurrentPage(): Page | undefined {
  const route = useAppRoute();
  return allPages.find((p) => p.path === route);
}
