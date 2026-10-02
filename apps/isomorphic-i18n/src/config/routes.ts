import type { ComponentType } from "react";
import {
  AnchorIcon,
  BookOpenIcon,
  ChartPieIcon,
  CircleDollarSignIcon,
  FishIcon,
  HouseIcon,
  ShieldAlertIcon,
  type LucideIcon,
} from "lucide-react";
import type { MetricKey } from "@repo/domain/metrics";
import { useAppRoute } from "@/i18n/use-lang";

/** The metrics a page offers and the one it opens on; the viewer's choice is `?metric=`. */
export type PageMetric = { default: MetricKey; options: MetricKey[] };

export type Page = {
  /** Path under `/:lang`. */
  path: string;
  /** The page's name, its h1. */
  titleKey: string;
  /** The question the page answers, under its title. */
  introKey: string;
  nav?: { labelKey: string; icon: LucideIcon };
  /** Header filters: the time range, and the district selection (see CONTEXT.md). */
  timeRange?: true;
  districts?: true;
  /** The metrics the page's charts can show. Each page keeps its own choice. */
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
    path: "/",
    titleKey: "page-home-title",
    introKey: "page-home-intro",
    nav: { labelKey: "text-home", icon: HouseIcon },
    timeRange: true,
    metric: {
      default: "mean_cpue",
      options: [
        "mean_cpue",
        "mean_catch_kg",
        "mean_catch_price",
        "n_submissions",
        "estimated_catch_tn",
      ],
    },
    load: () => import("@/pages/home"),
  },
  catch: {
    path: "/catch",
    titleKey: "page-catch-title",
    introKey: "page-catch-intro",
    nav: { labelKey: "nav-catch", icon: FishIcon },
    timeRange: true,
    districts: true,
    metric: {
      default: "mean_cpue",
      options: ["mean_cpue", "mean_catch_kg", "estimated_catch_tn", "estimated_fishing_trips"],
    },
    load: () => import("@/pages/catch"),
  },
  revenue: {
    path: "/revenue",
    titleKey: "page-revenue-title",
    introKey: "page-revenue-intro",
    nav: { labelKey: "nav-revenue", icon: CircleDollarSignIcon },
    timeRange: true,
    districts: true,
    metric: {
      default: "mean_rpue",
      options: ["mean_rpue", "mean_catch_price", "mean_price_kg", "estimated_revenue"],
    },
    load: () => import("@/pages/revenue"),
  },
  catchComposition: {
    path: "/catch_composition",
    titleKey: "page-species-title",
    introKey: "page-species-intro",
    nav: { labelKey: "nav-catch-composition", icon: ChartPieIcon },
    timeRange: true,
    districts: true,
    load: () => import("@/pages/catch-composition"),
  },
  gear: {
    path: "/gear",
    titleKey: "page-gear-title",
    introKey: "page-gear-intro",
    nav: { labelKey: "nav-gear", icon: AnchorIcon },
    timeRange: true,
    districts: true,
    load: () => import("@/pages/gear"),
  },
  vulnerableSpecies: {
    path: "/vulnerable_species",
    titleKey: "page-vulnerable-title",
    introKey: "page-vulnerable-intro",
    nav: { labelKey: "nav-vulnerable", icon: ShieldAlertIcon },
    timeRange: true,
    districts: true,
    load: () => import("@/pages/vulnerable-species"),
  },
  about: {
    path: "/about",
    titleKey: "page-methods-title",
    introKey: "page-methods-intro",
    nav: { labelKey: "nav-about", icon: BookOpenIcon },
    load: () => import("@/pages/about"),
  },
} satisfies Record<string, Page>;

/** The table as a list, in nav order. */
export const allPages: Page[] = Object.values(pages);

/** The table entry for the current path; undefined on a path with no page (not found). */
export function useCurrentPage(): Page | undefined {
  const route = useAppRoute();
  return allPages.find((p) => p.path === route);
}
