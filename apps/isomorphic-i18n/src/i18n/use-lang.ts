import { useTranslation } from "react-i18next";
import { useLocation, useParams, useSearchParams } from "react-router";
import { SCOPE_PARAMS } from "@/store/filters";
import { fallbackLng, languages } from "./settings";

/** The language from the `:lang` route segment. */
export function useLang() {
  const { lang } = useParams();
  return lang && languages.includes(lang) ? lang : fallbackLng;
}

/** Translation hook bound to the current route language. */
export function useT(ns?: string) {
  return { lang: useLang(), ...useTranslation(ns) };
}

/** The current path without its language prefix, e.g. `/sw/catch` → `/catch`. */
export function useAppRoute() {
  const lang = useLang();
  const route = useLocation().pathname.replace(new RegExp(`^/${lang}(?=/|$)`), "");
  return route === "" ? "/" : route;
}

/** Prefix an app path with the current language, e.g. `/catch` → `/sw/catch`. */
export function useLocalizedHref() {
  const lang = useLang();
  return (path: string) => (path === "/" ? `/${lang}` : `/${lang}${path}`);
}

/**
 * Like useLocalizedHref, keeping the time range and districts, so moving
 * between pages keeps the view; `set` replaces some of them (`{ d: "Kati" }`).
 */
export function useScopedHref() {
  const localized = useLocalizedHref();
  const [params] = useSearchParams();
  return (path: string, set: Record<string, string> = {}) => {
    const scope = new URLSearchParams(
      [...params].filter(([key]) => SCOPE_PARAMS.includes(key) && !(key in set)),
    );
    for (const [key, value] of Object.entries(set)) scope.set(key, value);
    return scope.size ? `${localized(path)}?${scope}` : localized(path);
  };
}
