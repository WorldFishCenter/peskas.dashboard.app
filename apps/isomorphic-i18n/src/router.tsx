import { type ComponentType, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createBrowserRouter, Navigate, Outlet, useLocation, useParams } from "react-router";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { SiteHeader } from "@/components/site-header";
import { languages, preferredLang, rememberLang } from "@/i18n/settings";
import { useT } from "@/i18n/use-lang";
import { allPages } from "@/config/routes";

/** Load a page on first visit, so each route ships its own chunk. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/** Send a path without a valid language prefix to the same path under the preferred language. */
function LangRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate replace to={`/${preferredLang(pathname)}${pathname.replace(/\/$/, "")}${search}`} />;
}

/** The `:lang` segment sets the UI language, `<html lang dir>` and the remembered choice. */
function LangLayout() {
  const { lang } = useParams();
  const { i18n } = useTranslation();
  const valid = !!lang && languages.includes(lang);

  useEffect(() => {
    if (!lang || !valid) return;
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = i18n.dir(lang);
    rememberLang(lang);
  }, [lang, valid, i18n]);

  return valid ? <Outlet /> : <LangRedirect />;
}

function DashboardLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="@container/main flex flex-1 flex-col gap-4 p-4">
        <Outlet />
      </main>
    </div>
  );
}

/** Shown instead of a page that crashed outside a chart, with a way back rather than a stack trace. */
function RouteError() {
  const { t } = useT();
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>{t("text-error")}</EmptyTitle>
          <EmptyDescription>{t("text-page-error-description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => window.location.reload()}>{t("text-reload")}</Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}

export const router = createBrowserRouter([
  { path: "/", Component: LangRedirect },
  {
    path: "/:lang",
    Component: LangLayout,
    ErrorBoundary: RouteError,
    // Blank while the first page's chunk loads.
    HydrateFallback: () => null,
    children: [
      {
        Component: DashboardLayout,
        children: allPages.map((p) =>
          p.path === "/" ? { index: true, lazy: page(p.load) } : { path: p.path.slice(1), lazy: page(p.load) }
        ),
      },
      { path: "*", lazy: page(() => import("@/pages/not-found")) },
    ],
  },
]);
