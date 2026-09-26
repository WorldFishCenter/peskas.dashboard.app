import type { ComponentType } from 'react';
import { atom, type PrimitiveAtom } from 'jotai';
import {
  AnchorIcon,
  BookOpenIcon,
  ChartPieIcon,
  CircleDollarSignIcon,
  FishIcon,
  HouseIcon,
  ShieldAlertIcon,
  type LucideIcon,
} from 'lucide-react';
import type { MetricKey } from '@repo/domain/metrics';
import { useAppRoute } from '@/i18n/use-lang';

/** The metric an analysis page charts: the viewer's choice and the choices offered. */
export type PageMetric = { atom: PrimitiveAtom<MetricKey>; options: MetricKey[] };

export type Page = {
  /** Path under `/:lang`. */
  path: string;
  titleKey: string;
  /** The question the page answers, shown under the header. */
  introKey: string;
  nav?: { labelKey: string; icon: LucideIcon };
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
    introKey: 'intro-home',
    nav: { labelKey: 'text-home', icon: HouseIcon },
    timeRange: true,
    load: () => import('@/pages/home'),
  },
  catch: {
    path: '/catch',
    titleKey: 'text-catch-analysis',
    introKey: 'intro-catch',
    nav: { labelKey: 'nav-catch', icon: FishIcon },
    timeRange: true,
    districts: true,
    metric: {
      atom: atom<MetricKey>('mean_cpue'),
      options: ['mean_cpue', 'mean_catch_kg', 'estimated_catch_tn', 'estimated_fishing_trips'],
    },
    load: () => import('@/pages/catch'),
  },
  revenue: {
    path: '/revenue',
    titleKey: 'text-revenue-analysis',
    introKey: 'intro-revenue',
    nav: { labelKey: 'nav-revenue', icon: CircleDollarSignIcon },
    timeRange: true,
    districts: true,
    metric: {
      atom: atom<MetricKey>('estimated_revenue'),
      options: ['mean_rpue', 'mean_catch_price', 'estimated_revenue', 'mean_price_kg'],
    },
    load: () => import('@/pages/revenue'),
  },
  catchComposition: {
    path: '/catch_composition',
    titleKey: 'text-catch-composition-analysis',
    introKey: 'intro-species',
    nav: { labelKey: 'nav-catch-composition', icon: ChartPieIcon },
    timeRange: true,
    districts: true,
    load: () => import('@/pages/catch-composition'),
  },
  gear: {
    path: '/gear',
    titleKey: 'text-gear-analysis',
    introKey: 'intro-gear',
    nav: { labelKey: 'nav-gear', icon: AnchorIcon },
    timeRange: true,
    districts: true,
    load: () => import('@/pages/gear'),
  },
  vulnerableSpecies: {
    path: '/vulnerable_species',
    titleKey: 'text-vulnerable-analysis',
    introKey: 'intro-vulnerable',
    nav: { labelKey: 'nav-vulnerable', icon: ShieldAlertIcon },
    timeRange: true,
    districts: true,
    load: () => import('@/pages/vulnerable-species'),
  },
  about: {
    path: '/about',
    titleKey: 'text-methods',
    introKey: 'intro-methods',
    nav: { labelKey: 'nav-about', icon: BookOpenIcon },
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
