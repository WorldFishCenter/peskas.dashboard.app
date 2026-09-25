"use client";

import { useParams, usePathname } from 'next/navigation';
import { useTranslation } from './client';
import { fallbackLng, languages } from './settings';

/** The language from the `[lang]` route segment. */
export function useLang() {
  const lang = useParams<{ lang?: string }>()?.lang;
  return lang && languages.includes(lang) ? lang : fallbackLng;
}

/** Translation hook bound to the current route language. */
export function useT(ns?: string) {
  const lang = useLang();
  return { lang, ...useTranslation(lang, ns) };
}

/** The current path without its language prefix, e.g. `/sw/catch` → `/catch`. */
export function useAppRoute() {
  const lang = useLang();
  const pathname = usePathname() ?? '/';
  const route = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), '');
  return route === '' ? '/' : route;
}

/** Prefix an app path with the current language, e.g. `/catch` → `/sw/catch`. */
export function useLocalizedHref() {
  const lang = useLang();
  return (path: string) => (path === '/' ? `/${lang}` : `/${lang}${path}`);
}
