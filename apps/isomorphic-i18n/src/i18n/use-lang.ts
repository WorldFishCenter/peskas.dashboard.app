import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router';
import { fallbackLng, languages } from './settings';

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
  const route = useLocation().pathname.replace(new RegExp(`^/${lang}(?=/|$)`), '');
  return route === '' ? '/' : route;
}

/** Prefix an app path with the current language, e.g. `/catch` → `/sw/catch`. */
export function useLocalizedHref() {
  const lang = useLang();
  return (path: string) => (path === '/' ? `/${lang}` : `/${lang}${path}`);
}
