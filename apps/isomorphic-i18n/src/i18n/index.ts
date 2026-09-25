import i18next from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';
import { fallbackLng, languages, preferredLang } from './settings';

// The `/:lang` route segment drives the language afterwards (see router.tsx).
void i18next
  .use(initReactI18next)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`)
    )
  )
  .init({
    lng: preferredLang(window.location.pathname),
    supportedLngs: languages,
    fallbackLng,
    ns: 'common',
    defaultNS: 'common',
    fallbackNS: 'common',
  });
