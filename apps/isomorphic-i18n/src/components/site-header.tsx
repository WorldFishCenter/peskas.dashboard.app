import { LanguageMenu } from "@/components/language-menu";
import { Brand, MainNav, MobileNav, Partner } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";

/** Sticky top bar: brand and partner, page navigation and app controls. Each page's title and filters open the page itself. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background print:static">
      <div className="flex h-12 items-center gap-2 px-4 md:gap-4 lg:px-6">
        <MobileNav />
        <Brand />
        <Partner />
        <MainNav />
        <div className="ml-auto flex items-center gap-1 print:hidden">
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
