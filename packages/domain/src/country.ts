/**
 * The countries this portal is deployed for, one Vercel project each. The
 * build (vite.config.ts), the browser and the tRPC server all read this
 * module, so it holds data and pure functions only: no env, no I/O.
 *
 * To add a country, follow apps/isomorphic-i18n/COUNTRY_SETUP.md.
 */

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  /** 0 opens the map flat, so cell and district colours read as they are; ⌘ + drag tilts it. */
  pitch?: number;
  bearing?: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface CountryConfig {
  /** Internal identifier matching the VITE_COUNTRY_CODE env var, e.g. 'TZ' */
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
  /** The organisation the dashboard is developed with, beside the brand in the top bar; `text-partner-<CODE>` names it in full */
  partner: {
    /** Its acronym, e.g. 'KEFS' */
    name: string;
    /** Logo in public/, shown on white in both themes */
    logoSrc: string;
    url?: string;
  };
  /** ISO 4217 currency code, e.g. 'TZS' */
  currencyCode: string;
  /** BCP 47 locale for number/date formatting, e.g. 'sw-TZ' */
  locale: string;
  /** Supported i18n languages. First entry is the fallback language.
   *  Must correspond to folder names under src/i18n/locales/. */
  languages: [string, ...string[]];
  /** Official GAUL2 names, exactly as the portal summaries store them */
  districts: string[];
  /** Region of every district (see Region in CONTEXT.md) */
  districtToRegion: Record<string, string>;
  /** Initial view of the home-page fishing-effort grid map */
  gridMapViewState: MapViewState;
  /** How the country's landing survey records the catch; the explanations and size views follow it. */
  survey: {
    /** The whole catch is weighed and only a sample identified, so catch by species describes the sample. */
    speciesFromSample?: true;
    /** Each species in a catch has its own price; otherwise one value covers the whole trip. */
    pricedBySpecies?: true;
    /** A catch row carries the mean length of the fish measured, not a length class; the size views say so. */
    meanLengths?: true;
  };
  features: {
    /** Regions in display order (district picker, district table); must name exactly the regions of districtToRegion. */
    regionBreakdown?: {
      regions: [string, ...string[]];
    };
  };
}

// ---------------------------------------------------------------------------
// Zanzibar (Tanzania)
// ---------------------------------------------------------------------------

const zanzibarConfig: CountryConfig = {
  countryCode: "TZ",
  iso3Code: "TZA",
  countryName: "Zanzibar",
  siteTitle: "PESKAS | Zanzibar Fisheries",
  siteDescription: "Peskas | Zanzibar Fisheries Dashboard",
  flagIconSrc: "/zanzibar-flag.svg",
  partner: { name: "ZAFIRI", logoSrc: "/zafiri-logo.png" },
  currencyCode: "TZS",
  locale: "sw-TZ",
  languages: ["sw", "en"],
  districts: [
    "Chake Chake",
    "Kaskazini A",
    "Kaskazini B",
    "Kati",
    "Kusini",
    "Magharibi A",
    "Magharibi B",
    "Micheweni",
    "Mjini",
    "Mkoani",
    "Wete",
  ],
  districtToRegion: {
    "Chake Chake": "Pemba",
    "Kaskazini A": "Unguja",
    "Kaskazini B": "Unguja",
    Kati: "Unguja",
    Kusini: "Unguja",
    "Magharibi A": "Unguja",
    "Magharibi B": "Unguja",
    Micheweni: "Pemba",
    Mjini: "Unguja",
    Mkoani: "Pemba",
    Wete: "Pemba",
  },
  // Both islands, Pemba to the north of Unguja.
  gridMapViewState: {
    longitude: 39.5,
    latitude: -5.65,
    zoom: 7.4,
    pitch: 0,
    bearing: 0,
  },
  survey: {},
  features: {
    regionBreakdown: {
      regions: ["Unguja", "Pemba"],
    },
  },
};

// ---------------------------------------------------------------------------
// Kenya
// ---------------------------------------------------------------------------

const kenyaConfig: CountryConfig = {
  countryCode: "KE",
  iso3Code: "KEN",
  countryName: "Kenya",
  siteTitle: "PESKAS | Kenya Fisheries",
  siteDescription: "Peskas | Kenya Fisheries Dashboard",
  flagIconSrc: "/kenya-flag.svg",
  partner: { name: "KEFS", logoSrc: "/kefs-logo.png", url: "https://kefs.go.ke/" },
  currencyCode: "KES",
  locale: "sw-KE",
  languages: ["sw", "en"],
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
    "Garsen",
  ],
  districtToRegion: {
    Changamwe: "Central",
    Jomvu: "Central",
    Kisauni: "Central",
    Likoni: "Central",
    Mvita: "Central",
    Nyali: "Central",
    "Kilifi North": "North",
    "Kilifi South": "North",
    Magarini: "North",
    Malindi: "North",
    Garsen: "North",
    Lamu: "North",
    "Lamu East": "North",
    "Lamu West": "North",
    Kinango: "South",
    "Lunga Lunga": "South",
    Matuga: "South",
    Msambweni: "South",
  },
  // Kenya Map viewport tuned for coast region (centered on Mombasa/Malindi axis)
  // Grid map view focused on southern coast (centered for Nyali/Diani zone)
  gridMapViewState: {
    longitude: 39.6,
    latitude: -3.5,
    zoom: 7,
    pitch: 0,
    bearing: 0,
  },
  // KEFS weighs the whole catch, prices and identifies a sample of it, and
  // records the mean length of the fish it measures.
  survey: { speciesFromSample: true, pricedBySpecies: true, meanLengths: true },
  features: {
    regionBreakdown: {
      regions: ["Central", "North", "South"],
    },
  },
};

// ---------------------------------------------------------------------------
// Mozambique
// ---------------------------------------------------------------------------

const mozambiqueConfig: CountryConfig = {
  countryCode: "MZ",
  iso3Code: "MOZ",
  countryName: "Mozambique",
  siteTitle: "PESKAS | Mozambique Fisheries",
  siteDescription: "Peskas | Mozambique Fisheries Dashboard",
  flagIconSrc: "/mozambique-flag.svg",
  partner: { name: "ADNAP", logoSrc: "/adnap-logo.png", url: "https://adnap.gov.mz/" },
  currencyCode: "MZN",
  locale: "pt-MZ",
  languages: ["pt", "en", "sw"],
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
    "Mogincual",
    "Moma",
    "Nacala",
    "Namacurra",
    "Pebane",
    "Pemba",
    "Quelimane",
    "Xai-Xai",
    "Zavala",
  ],
  districtToRegion: {
    Angoche: "North",
    Ibo: "North",
    "Ilha De Moçambique": "North",
    Larde: "North",
    Mecúfi: "North",
    Mogincual: "North",
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
  // The coast in the middle: the district boundaries reach inland, the fishing doesn't.
  gridMapViewState: {
    longitude: 36.8,
    latitude: -18.6,
    zoom: 5,
    pitch: 0,
    bearing: 0,
  },
  survey: {},
  features: {
    regionBreakdown: {
      regions: ["Central", "North", "South"],
    },
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const COUNTRY_REGISTRY: Record<string, CountryConfig> = {
  TZ: zanzibarConfig,
  KE: kenyaConfig,
  MZ: mozambiqueConfig,
};

/** The country for a VITE_COUNTRY_CODE value; Zanzibar (TZ) when it is unset. */
export function resolveCountry(code: string | undefined): CountryConfig {
  const country = COUNTRY_REGISTRY[code || "TZ"];
  if (!country)
    throw new Error(
      `Unknown VITE_COUNTRY_CODE "${code}" (expected ${Object.keys(COUNTRY_REGISTRY).join(", ")})`,
    );
  return country;
}
