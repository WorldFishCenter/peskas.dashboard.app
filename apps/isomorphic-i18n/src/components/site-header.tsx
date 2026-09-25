import { Separator } from "@workspace/ui/components/separator";
import { useAppRoute, useT } from "@/i18n/use-lang";
import { HeaderFilters } from "@/components/filters/header-filters";
import { LanguageMenu } from "@/components/language-menu";
import { Brand, MainNav, MobileNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { routes } from "@/config/routes";

const TITLE_KEYS: Record<string, string> = {
  [routes.home]: "text-home",
  [routes.catch]: "text-catch-analysis",
  [routes.revenue]: "text-revenue-analysis",
  [routes.catchComposition]: "text-catch-composition-analysis",
  [routes.about]: "nav-about",
};

/** Sticky top bar: brand, page navigation and app controls, then the page title with its filters. */
export function SiteHeader() {
  const { t } = useT();
  const titleKey = TITLE_KEYS[useAppRoute()];

  return (
    <header className="sticky top-0 z-10 bg-background">
      <div className="flex h-12 items-center gap-2 px-4 md:gap-4">
        <MobileNav />
        <Brand />
        <MainNav />
        <div className="ml-auto flex items-center gap-1">
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </div>
      <Separator />
      <div className="flex h-11 items-center gap-2 px-4">
        {titleKey && <h1 className="truncate text-base font-medium">{t(titleKey)}</h1>}
        <div className="ml-auto">
          <HeaderFilters />
        </div>
      </div>
      <Separator />
    </header>
  );
}
