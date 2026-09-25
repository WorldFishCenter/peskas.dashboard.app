import type { Metadata } from 'next';
import type { OpenGraph } from 'next/dist/lib/metadata/types/opengraph-types';
import { activeCountry } from '@/config/countryConfig';

export const siteConfig = {
  title: activeCountry.siteTitle,
  description: activeCountry.siteDescription,
  defaultTheme: 'light',
  favicon: '/sailboat-icon.svg',
};

export const metaObject = (
  title?: string,
  openGraph?: OpenGraph,
  description: string = siteConfig.description
): Metadata => {
  const pageTitle = title ? `${title} - ${siteConfig.title}` : siteConfig.title;

  return {
    title: pageTitle,
    description,
    openGraph: openGraph ?? {
      title: pageTitle,
      description,
      siteName: siteConfig.title, // https://developers.google.com/search/docs/appearance/site-names
      locale: activeCountry.locale.replace('-', '_'),
      type: 'website',
    },
  };
};
