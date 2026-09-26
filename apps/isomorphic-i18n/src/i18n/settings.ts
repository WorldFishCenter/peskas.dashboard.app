import { activeCountry } from '@/config/countryConfig';

export const fallbackLng = activeCountry.languages[0];
export const languages: string[] = [...activeCountry.languages];

const STORAGE_KEY = 'selectedLanguage';

/** The language in the path's first segment, else the last one chosen, else the fallback. */
export function preferredLang(pathname: string): string {
  const fromPath = pathname.split('/')[1];
  if (languages.includes(fromPath)) return fromPath;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked: fall back rather than blank the app.
  }
  return stored && languages.includes(stored) ? stored : fallbackLng;
}

export function rememberLang(lang: string) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage blocked: the path still carries the language.
  }
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  sw: 'Kiswahili',
  pt: 'Português',
};
