/**
 * District/region data for the API layer, mirroring countryConfig.ts in the app.
 * Selected at build time via the NEXT_PUBLIC_COUNTRY_CODE env var (default: 'TZ').
 *
 * IMPORTANT: district names and region mappings here must stay in sync with
 * countryConfig.districtToRegion in apps/isomorphic-i18n/src/config/countryConfig.ts.
 * Both files carry the same data but serve different consumers:
 *   - gaul2-districts.ts → API (packages/api cannot import from apps/)
 *   - countryConfig.ts   → UI
 */

// ---------------------------------------------------------------------------
// Zanzibar (TZ)
// ---------------------------------------------------------------------------

const TZ_DISTRICT_NAMES = [
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
] as const;

const TZ_TO_REGION: Record<string, string> = {
  'Chake Chake': 'Pemba',
  'Kaskazini A': 'Unguja',
  'Kaskazini B': 'Unguja',
  'Kati':        'Unguja',
  'Kusini':      'Unguja',
  'Magharibi A': 'Unguja',
  'Magharibi B': 'Unguja',
  'Micheweni':   'Pemba',
  'Mjini':       'Unguja',
  'Mkoani':      'Pemba',
  'Wete':        'Pemba',
};

// ---------------------------------------------------------------------------
// Kenya (KE)
// ---------------------------------------------------------------------------

const KE_DISTRICT_NAMES = [
  'Changamwe',
  'Jomvu',
  'Kilifi North',
  'Kilifi South',
  'Kinango',
  'Kisauni',
  'Lamu',
  'Lamu East',
  'Lamu West',
  'Likoni',
  'Lunga Lunga',
  'Magarini',
  'Malindi',
  'Matuga',
  'Msambweni',
  'Mvita',
  'Nyali',
  'Garsen',
] as const;

const KE_TO_REGION: Record<string, string> = {
  'Changamwe':   'Central',
  'Jomvu':       'Central',
  'Kisauni':     'Central',
  'Likoni':      'Central',
  'Mvita':       'Central',
  'Nyali':       'Central',
  'Kilifi North':'North',
  'Kilifi South':'North',
  'Magarini':    'North',
  'Malindi':     'North',
  'Garsen':      'North',
  'Lamu':        'North',
  'Lamu East':   'North',
  'Lamu West':   'North',
  'Kinango':     'South',
  'Lunga Lunga': 'South',
  'Matuga':      'South',
  'Msambweni':   'South',
};

// ---------------------------------------------------------------------------
// Mozambique (MZ)
// ---------------------------------------------------------------------------

const MZ_DISTRICT_NAMES = [
  'Angoche',
  'Beira',
  'Bilene',
  'Buzi',
  'Cidade De Maputo',
  'Ibo',
  'Ilha De Moçambique',
  'Inhassoro',
  'Larde',
  'Maxixe',
  'Mecúfi',
  'Moma',
  'Nacala',
  'Namacurra',
  'Pebane',
  'Pemba',
  'Quelimane',
  'Xai-Xai',
  'Zavala',
] as const;

const MZ_TO_REGION: Record<string, string> = {
  'Angoche':             'North',
  'Ibo':                 'North',
  'Ilha De Moçambique':  'North',
  'Larde':               'North',
  'Mecúfi':              'North',
  'Moma':                'North',
  'Nacala':              'North',
  'Pemba':               'North',
  'Beira':               'Central',
  'Buzi':                'Central',
  'Inhassoro':           'Central',
  'Namacurra':           'Central',
  'Pebane':              'Central',
  'Quelimane':           'Central',
  'Bilene':              'South',
  'Cidade De Maputo':    'South',
  'Maxixe':              'South',
  'Xai-Xai':             'South',
  'Zavala':              'South',
};

// ---------------------------------------------------------------------------
// Registry and active exports
// ---------------------------------------------------------------------------

const DISTRICT_REGISTRY = {
  TZ: { names: TZ_DISTRICT_NAMES, toRegion: TZ_TO_REGION },
  KE: { names: KE_DISTRICT_NAMES, toRegion: KE_TO_REGION },
  MZ: { names: MZ_DISTRICT_NAMES, toRegion: MZ_TO_REGION },
} as const;

const code = (process.env.NEXT_PUBLIC_COUNTRY_CODE ?? 'TZ') as keyof typeof DISTRICT_REGISTRY;
const active = DISTRICT_REGISTRY[code] ?? DISTRICT_REGISTRY['TZ'];

export const GAUL2_DISTRICT_NAMES = active.names;
export type GAUL2DistrictName = (typeof active.names)[number];
export const GAUL2_TO_REGION: Record<string, string> = active.toRegion;
