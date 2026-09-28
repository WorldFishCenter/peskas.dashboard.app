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
