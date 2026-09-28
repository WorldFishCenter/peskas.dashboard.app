import { useState } from "react";
import { MenuIcon, SailboatIcon } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Button } from "@workspace/ui/components/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@workspace/ui/components/navigation-menu";
import { Separator } from "@workspace/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { cn } from "@workspace/ui/lib/utils";
import { useLocalizedHref, useScopedHref, useT } from "@/i18n/use-lang";
import { activeCountry } from "@/config/countryConfig";
import { allPages, pages } from "@/config/routes";

const NAV_ITEMS = allPages.flatMap((p) => (p.nav ? [{ ...p.nav, href: p.path }] : []));

/** Nav items with their href (keeping the time range and districts) and whether they are the current page. */
function useNavItems() {
  const { pathname } = useLocation();
  const localized = useLocalizedHref();
  const scoped = useScopedHref();
  return NAV_ITEMS.map((item) => ({
    ...item,
    href: scoped(item.href),
    active: pathname === localized(item.href),
  }));
}

export function Brand() {
  const scoped = useScopedHref();
  return (
    <Link to={scoped(pages.home.path)} className="flex shrink-0 items-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <SailboatIcon className="size-4" />
      </div>
      <div className="grid text-sm leading-tight">
        <span className="font-semibold">PESKAS™</span>
        <span className="text-xs text-muted-foreground">{activeCountry.countryName}</span>
      </div>
      {activeCountry.flagIconSrc && (
        <img src={activeCountry.flagIconSrc} alt="" width={24} height={16} className="rounded-sm" />
      )}
    </Link>
  );
}

/** The partner the dashboard is developed with, beside the brand; hovering shows the full line. */
export function Partner() {
  const { t } = useT();
  const { partner, countryCode } = activeCountry;
  return (
    <>
      <Separator orientation="vertical" className="data-vertical:h-6 data-vertical:self-center" />
      {/* Without a url the <a> is a placeholder, not a link (ZAFIRI has no website). */}
      <a
        href={partner.url}
        target="_blank"
        rel="noreferrer"
        title={t(`text-partner-${countryCode}`)}
        className="flex shrink-0 items-center gap-2"
      >
        {/* The logos are drawn for a light page, so they sit on white in dark mode too. */}
        <img src={partner.logoSrc} alt="" className="h-8 w-auto rounded-md bg-white p-0.5" />
        {/* No room for the words in a phone's top bar, nor beside the full nav until 1320px (its
            Portuguese labels, the longest, need 1296px); screen readers still get them. */}
        <span className="sr-only grid leading-tight sm:max-xl:not-sr-only min-[1320px]:not-sr-only">
          <span className="text-xs text-muted-foreground">{t("text-partner-with")}</span>
          <span className="text-sm font-semibold">{partner.name}</span>
        </span>
      </a>
    </>
  );
}

/** Desktop navigation: one link per page. */
export function MainNav() {
  const { t } = useT();
  return (
    <NavigationMenu className="hidden xl:flex">
      <NavigationMenuList>
        {useNavItems().map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink
              render={<Link to={item.href} />}
              active={item.active}
              // Base UI marks the current link with a bare `data-active` attribute, which the
              // component's own `data-[active=true]` style doesn't match; apply that style here.
              className={cn(navigationMenuTriggerStyle(), "data-active:bg-muted/50")}
            >
              {t(item.labelKey)}
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

/** Mobile navigation in a side sheet. */
export function MobileNav() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const items = useNavItems();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden print:hidden"
            aria-label={t("text-open-menu")}
          />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="sr-only">PESKAS™</SheetTitle>
          <Brand />
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {items.map((item) => (
            <Button
              key={item.href}
              variant={item.active ? "secondary" : "ghost"}
              className="justify-start"
              nativeButton={false}
              render={<Link to={item.href} onClick={() => setOpen(false)} />}
            >
              <item.icon data-icon="inline-start" />
              {t(item.labelKey)}
            </Button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
