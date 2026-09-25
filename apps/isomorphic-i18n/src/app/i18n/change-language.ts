"use client";

import { languages } from './settings';

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  sw: 'Kiswahili',
  pt: 'Português',
};

// Every key the i18n detector and LanguageInitializer read.
const STORAGE_KEYS = ['i18nextLng', 'selectedLanguage', 'peskas-language'];

const langPrefixRegex = new RegExp(`^/(${languages.join('|')})(?=/|$)`);

/**
 * Persist the language and reload the current page under the new prefix.
 * The middleware then syncs the `i18next` cookie from the URL.
 */
export function changeAppLanguage(newLang: string): void {
  if (!languages.includes(newLang)) return;

  for (const storage of [localStorage, sessionStorage]) {
    for (const key of STORAGE_KEYS) storage.setItem(key, newLang);
  }

  const currentPath = window.location.pathname;
  const newPath = langPrefixRegex.test(currentPath)
    ? currentPath.replace(langPrefixRegex, `/${newLang}`)
    : `/${newLang}${currentPath.startsWith('/') ? '' : '/'}${currentPath}`;

  if (newPath !== currentPath) window.location.pathname = newPath;
}
