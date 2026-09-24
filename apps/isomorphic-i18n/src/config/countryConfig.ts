/**
 * Country configuration for multi-country deployment.
 * Select the active country at build time via the NEXT_PUBLIC_COUNTRY_CODE env var (default: 'TZ').
 *
 * IMPORTANT: districtToRegion must mirror
 * packages/nosql/src/constants/gaul2-districts.ts GAUL2_TO_REGION,
 * because the district-summary API router uses that file to group data by region.
 * The region keys (e.g. 'Unguja', 'Pemba') flow from the API into file-stats.tsx
 * as data field names. Both must be updated together when adding a new country.
 *
 * To add a new country:
 *   1. Add an entry to COUNTRY_REGISTRY below.
 *   2. Update packages/nosql/src/constants/gaul2-districts.ts with the new
 *      district/region mapping for the new country's DB data.
 *   3. Add locale files under src/app/i18n/locales/<lang>/common.json.
 *   4. Set NEXT_PUBLIC_COUNTRY_CODE and MONGODB_URI env vars in the new deployment.
 */

import type { ComponentType } from 'react';

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface CountryConfig {
  /** Internal identifier matching NEXT_PUBLIC_COUNTRY_CODE env var, e.g. 'TZ' */
  countryCode: string;
  /** ISO 3166-1 alpha-3 code used to filter wio_gaul2 boundaries, e.g. 'TZA' */
  iso3Code: string;
  /** Human-readable country/region name used in page titles, e.g. 'Zanzibar' */
  countryName: string;
  /** Browser tab title */
  siteTitle: string;
  /** Meta description */
  siteDescription: string;
  /** Optional country flag asset path (e.g. for header/branding) */
  flagIconSrc?: string;
  /** ISO 4217 currency code, e.g. 'TZS' */
  currencyCode: string;
  /** BCP 47 locale for number/date formatting, e.g. 'sw-TZ' */
  locale: string;
  /** Supported i18n languages. First entry is the fallback language.
   *  Must correspond to folder names under src/app/i18n/locales/. */
  languages: [string, ...string[]];
  /** Official adm2 district names as stored in MongoDB gaul_2_name field */
  districts: string[];
  /** Maps district name → parent region name. Must mirror GAUL2_TO_REGION
   *  in packages/nosql/src/constants/gaul2-districts.ts — see note above. */
  districtToRegion: Record<string, string>;
  /** Per-district hex colors for chart visualization */
  districtColors: Record<string, string>;
  /** View state for the DeckGL hexbin map */
  mapViewState: MapViewState;
  /** View state for the H3 grid map */
  gridMapViewState: MapViewState;
  /** Districts pre-selected in the district filter on first visit */
  defaultSelectedDistricts: string[];
  features: {
    /** Sub-region breakdown bars shown in homepage metric cards.
     *  Regions must exactly match the keys returned by the
     *  districtSummary.getMonthlyRegionSummary tRPC procedure.
     *  Set to undefined for countries with no meaningful sub-regions. */
    regionBreakdown?: {
      regions: [string, ...string[]];
      colors: Record<string, string>;
    };
    /** Optional slot component for country-specific homepage sections.
     *  Zanzibar example: island-level summary cards (Pemba / Unguja). */
    homepageExtras?: ComponentType;
  };
}

// ---------------------------------------------------------------------------
// Zanzibar (Tanzania)
// ---------------------------------------------------------------------------

const zanzibarConfig: CountryConfig = {
  countryCode: 'TZ',
  iso3Code: 'TZA',
  countryName: 'Zanzibar',
  siteTitle: 'PESKAS | Zanzibar Fisheries',
  siteDescription: 'Peskas | Zanzibar Fisheries Dashboard',
  flagIconSrc: '/zanzibar-flag.svg',
  currencyCode: 'TZS',
  locale: 'sw-TZ',
  languages: ['sw', 'en'],
  districts: [
    'Chake Chake',
    'Kaskazini A',
    'Kaskazini B',
    'Kati',
    'Kusini',
    'Magharibi A',
    'Magharibi B',
    'Micheweni',
    'Mjini',
    'Mkoani',
    'Wete',
  ],
  districtToRegion: {
    'Chake Chake': 'Pemba',
    'Kaskazini A': 'Unguja',
    'Kaskazini B': 'Unguja',
    'Kati': 'Unguja',
    'Kusini': 'Unguja',
    'Magharibi A': 'Unguja',
    'Magharibi B': 'Unguja',
    'Micheweni': 'Pemba',
    'Mjini': 'Unguja',
    'Mkoani': 'Pemba',
    'Wete': 'Pemba',
  },
  // Based on the ColorsWall palette (https://colorswall.com/palette/178887) + Blue-grey lighten-2
  districtColors: {
    'Chake Chake': '#167288',  // Semi dark teal
    'Kaskazini A': '#8cdaec',  // Light sky blue
    'Kaskazini B': '#b45248',  // Semi dark red
    'Kati':        '#d48c84',  // Light rosy brown
    'Kusini':      '#a89a49',  // Semi dark khaki
    'Magharibi A': '#d6cfa2',  // Light pale goldenrod
    'Magharibi B': '#3cb464',  // Semi dark green
    'Micheweni':   '#9bddb1',  // Light medium aquamarine
    'Mjini':       '#643c6a',  // Semi dark purple
    'Mkoani':      '#836394',  // Light medium purple
    'Wete':        '#90a4ae',  // Blue-grey lighten-2
  },
  mapViewState: {
    longitude: 39.8,
    latitude: -4.3,
    zoom: 8,
    minZoom: 5,
    maxZoom: 15,
    pitch: 40.5,
  },
  gridMapViewState: {
    longitude: 39.19,
    latitude: -6.16,
    zoom: 8,
    pitch: 45,
    bearing: 10,
  },
  defaultSelectedDistricts: ['Wete', 'Kati', 'Kaskazini A', 'Kaskazini B', 'Kusini', 'Magharibi A', 'Magharibi B', 'Micheweni', 'Mjini', 'Mkoani', 'Chake Chake'],
  features: {
    regionBreakdown: {
      regions: ['Unguja', 'Pemba'],
      colors: { Unguja: '#F28F3B', Pemba: '#75ABBC' },
    },
    homepageExtras: undefined,
  },
};

// ---------------------------------------------------------------------------
// Kenya
// ---------------------------------------------------------------------------

const kenyaConfig: CountryConfig = {
  countryCode: 'KE',
  iso3Code: 'KEN',
  countryName: 'Kenya',
  siteTitle: 'PESKAS | Kenya Fisheries',
  siteDescription: 'Peskas | Kenya Fisheries Dashboard',
  flagIconSrc: '/kenya-flag.svg',
  currencyCode: 'KES',
  locale: 'sw-KE',
  languages: ['sw', 'en'],
  districts: [
    "Changamwe",
    "Jomvu",
    "Kilifi North",
    "Kilifi South",
    "Kinango",
    "Kisauni",
    "Lamu",
    "Lamu East",
    "Lamu West",
    "Likoni",
    "Lunga Lunga",
    "Magarini",
    "Malindi",
    "Matuga",
    "Msambweni",
    "Mvita",
    "Nyali",
    "Garsen"
  ],
  districtToRegion: {
    'Changamwe': 'Central',
    'Jomvu': 'Central',
    'Kisauni': 'Central',
    'Likoni': 'Central',
    'Mvita': 'Central',
    'Nyali': 'Central',
    'Kilifi North': 'North',
    'Kilifi South': 'North',
    'Magarini': 'North',
    'Malindi': 'North',
    'Garsen': 'North',
    'Lamu': 'North',
    'Lamu East': 'North',
    'Lamu West': 'North',
    'Kinango': 'South',
    'Lunga Lunga': 'South',
    'Matuga': 'South',
    'Msambweni': 'South',
  },
  // Based on the ColorsWall palette (https://colorswall.com/palette/178887) + Blue-grey lighten-2

  districtColors: {
    'Changamwe':    '#167288',  // Semi dark teal
    'Jomvu':        '#8cdaec',  // Light sky blue
    'Kilifi North': '#b45248',  // Semi dark red
    'Kilifi South': '#d48c84',  // Light rosy brown
    'Kinango':      '#a89a49',  // Semi dark khaki
    'Kisauni':      '#d6cfa2',  // Light pale goldenrod
    'Lamu':         '#3cb464',  // Semi dark green
    'Lamu East':    '#9bddb1',  // Light medium aquamarine
    'Lamu West':    '#643c6a',  // Semi dark purple
    'Likoni':       '#836394',  // Light medium purple
    'Lunga Lunga':  '#90a4ae',  // Blue-grey lighten-2
    'Magarini':     '#F28F3B',  // Palette supplement/Orange
    'Malindi':      '#75ABBC',  // Palette supplement/Blue-green
    'Matuga':       '#F8C16C',  // Palette supplement/Light gold
    'Msambweni':    '#FF7E6B',  // Palette supplement/Coral
    'Mvita':        '#9F82B2',  // Palette supplement/Lavender
    'Nyali':        '#A1C181',  // Palette supplement/Moss green
    'Garsen':       '#FDBCB4',  // Palette supplement/Pink peach
  },
  // Kenya Map viewport tuned for coast region (centered on Mombasa/Malindi axis)
  mapViewState: {
    longitude: 38.12,
    latitude: -3.60,
    zoom: 7.1,
    minZoom: 5.5,
    maxZoom: 14.5,
    pitch: 39,
    bearing: 1,
  },
  // Grid map view focused on southern coast (centered for Nyali/Diani zone)
  gridMapViewState: {
    longitude: 39.0,
    latitude: -3.9,
    zoom: 7,
    pitch: 42,
    bearing: 7,
  },
  defaultSelectedDistricts: ['Malindi', 'Kinango', 'Lamu'],
  features: {
    regionBreakdown: {
      regions: ['Central', 'North', 'South'],
      colors: { Central: '#F28F3B', North: '#75ABBC', South: '#9bddb1' },
    },
    homepageExtras: undefined,
  },
};

// ---------------------------------------------------------------------------
// Mozambique
// ---------------------------------------------------------------------------

const mozambiqueConfig: CountryConfig = {
  countryCode: 'MZ',
  iso3Code: 'MOZ',
  countryName: 'Mozambique',
  siteTitle: 'PESKAS | Mozambique Fisheries',
  siteDescription: 'Peskas | Mozambique Fisheries Dashboard',
  flagIconSrc: '/mozambique-flag.svg',
  currencyCode: 'MZN',
  locale: 'pt-MZ',
  languages: ['pt', 'en', 'sw'],
  districts: [
    "Angoche",
    "Beira",
    "Bilene",
    "Buzi",
    "Cidade De Maputo",
    "Ibo",
    "Ilha De Moçambique",
    "Inhassoro",
    "Larde",
    "Maxixe",
    "Mecúfi",
    "Moma",
    "Nacala",
    "Namacurra",
    "Pebane",
    "Pemba",
    "Quelimane",
    "Xai-Xai",
    "Zavala"
  ],
  districtToRegion: {
    Angoche: "North",
    Ibo: "North",
    "Ilha De Moçambique": "North",
    Larde: "North",
    Mecúfi: "North",
    Moma: "North",
    Nacala: "North",
    Pemba: "North",
    Beira: "Central",
    Buzi: "Central",
    Inhassoro: "Central",
    Namacurra: "Central",
    Pebane: "Central",
    Quelimane: "Central",
    Bilene: "South",
    "Cidade De Maputo": "South",
    Maxixe: "South",
    "Xai-Xai": "South",
    Zavala: "South",
  },
  // Based on the ColorsWall palette (https://colorswall.com/palette/178887) + Blue-grey lighten-2

  districtColors: {
    'Angoche':      '#75ABBC',  // Blue-green
    'Beira':        '#F28F3B',  // Orange
    'Bilene':       '#9bddb1',  // Medium aquamarine
    'Buzi':         '#90a4ae',  // Blue-grey lighten-2
    'Cidade De Maputo': '#F8C16C', // Light gold
    'Ibo':          '#FDBCB4',  // Pink peach
    'Ilha De Moçambique': '#9F82B2', // Lavender
    'Inhassoro':    '#FF7E6B',  // Coral
    'Larde':        '#A1C181',  // Moss green
    'Maxixe':       '#167288',  // Semi dark teal
    'Mecúfi':       '#d48c84',  // Light rosy brown
    'Moma':         '#b45248',  // Semi dark red
    'Nacala':       '#836394',  // Light medium purple
    'Namacurra':    '#a89a49',  // Semi dark khaki
    'Pebane':       '#d6cfa2',  // Light pale goldenrod
    'Pemba':        '#3cb464',  // Semi dark green
    'Quelimane':    '#643c6a',  // Semi dark purple
    'Xai-Xai':      '#8cdaec',  // Light sky blue
    'Zavala':       '#8c6d46',  // Palette supplement/Warm brown
  },
  mapViewState: {
    longitude: 32.61,
    latitude: -19.09,
    zoom: 5,
    minZoom: 5,
    maxZoom: 14,
    pitch: 45,
  },
  gridMapViewState: {
    longitude: 32.61,
    latitude: -19.09,
    zoom: 5,
    pitch: 45,
    bearing: 0,
  },
  defaultSelectedDistricts: ['Pemba', 'Angoche', 'Beira'],
  features: {
    regionBreakdown: {
      regions: ['Central', 'North', 'South'],
      colors: { Central: '#F28F3B', North: '#75ABBC', South: '#9bddb1' },
    },
    homepageExtras: undefined,
  },
};

// ---------------------------------------------------------------------------
// Registry and active country export
// ---------------------------------------------------------------------------

const COUNTRY_REGISTRY: Record<string, CountryConfig> = {
  TZ: zanzibarConfig,
  KE: kenyaConfig,
  MZ: mozambiqueConfig,
};

/**
 * The active country configuration for this deployment.
 * Resolved once at module load from the NEXT_PUBLIC_COUNTRY_CODE env var.
 * Defaults to 'TZ' (Zanzibar) when NEXT_PUBLIC_COUNTRY_CODE is unset or unknown.
 */
export const activeCountry: CountryConfig =
  COUNTRY_REGISTRY[process.env.NEXT_PUBLIC_COUNTRY_CODE ?? 'TZ'] ?? zanzibarConfig;
