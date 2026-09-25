import { type ComponentType, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createBrowserRouter, Navigate, Outlet, useLocation, useParams } from "react-router";
import { SiteHeader } from "@/components/site-header";
import { languages, preferredLang, rememberLang } from "@/i18n/settings";

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

export const router = createBrowserRouter([
  { path: "/", Component: LangRedirect },
  {
    path: "/:lang",
    Component: LangLayout,
    // Blank while the first page's chunk loads.
    HydrateFallback: () => null,
    children: [
      {
        Component: DashboardLayout,
        children: [
          { index: true, lazy: page(() => import("@/pages/home")) },
          { path: "catch", lazy: page(() => import("@/pages/catch")) },
          { path: "revenue", lazy: page(() => import("@/pages/revenue")) },
          { path: "catch_composition", lazy: page(() => import("@/pages/catch-composition")) },
          { path: "about", lazy: page(() => import("@/pages/about")) },
          { path: "ask-data", lazy: page(() => import("@/pages/ask-data")) },
          { path: "admin/users", lazy: page(() => import("@/pages/admin-users")) },
        ],
      },
      { path: "sign-in", lazy: page(() => import("@/pages/sign-in")) },
      { path: "forgot-password", lazy: page(() => import("@/pages/forgot-password")) },
      { path: "reset-password/:token", lazy: page(() => import("@/pages/reset-password")) },
      { path: "*", lazy: page(() => import("@/pages/not-found")) },
    ],
  },
]);
