# Adding a Country to the Peskas Dashboard

Each country runs as a **separate deployment** pointing to its own MongoDB database.
Adding a new country requires updating 2 config files, adding locale files and setting the deployment's env vars (Step 4; the full list is in `turbo.json`) — no core code changes.

---

## How region data flows (read this before editing anything)

```
MongoDB (country DB)
  └─ district_summaries collection
       (rows have gaul_2_name = district name, indicator = metric name, value = number)
       │
       ▼
packages/nosql/src/constants/gaul2-districts.ts
       GAUL2_TO_REGION maps district → region name
       │
       ▼
packages/api/src/router/district-summary.ts  (getMonthlyRegionSummary)
       Groups rows by region, returns { month, RegionA: avg, RegionB: avg, ... }
       │
       ▼
apps/isomorphic-i18n/src/lib/dashboard/regions.ts
       Reads features.regionBreakdown.regions (src/config/countries.ts) to know which keys to render as bars
```

**The region names must be identical** across `gaul2-districts.ts` (API grouping) and
`countryConfig.districtToRegion` / `regionBreakdown.regions` (UI rendering).
A mismatch means the UI reads undefined values and shows `-` for every bar.

---

## Step 1 — `countries.ts`

**File**: `apps/isomorphic-i18n/src/config/countries.ts`

Add an entry to `COUNTRY_REGISTRY`. Use the Zanzibar config as a template:

```ts
const kenyaConfig: CountryConfig = {
  countryCode: 'KE',                           // matches VITE_COUNTRY_CODE env var
  countryName: 'Kenya',                         // used in page titles and map heading
  siteTitle: 'PESKAS | Kenya Fisheries',
  siteDescription: 'Peskas | Kenya Fisheries Dashboard',
  currencyCode: 'KES',                          // ISO 4217
  locale: 'sw-KE',                              // BCP 47 — used for number/date formatting
  languages: ['en', 'sw'],                      // must match locale folder names (Step 3)
  districts: ['Kwale', 'Kilifi', 'Mombasa'],   // exact gaul_2_name values from your MongoDB
  districtToRegion: {
    'Kwale':    'Coast South',                  // values must match regionBreakdown.regions
    'Kilifi':   'Coast North',
    'Mombasa':  'Coast North',
  },
  districtColors: {
    'Kwale':   '#167288',
    'Kilifi':  '#8cdaec',
    'Mombasa': '#b45248',
  },
  gridMapViewState: { longitude: 39.7, latitude: -2.0, zoom: 7, pitch: 45, bearing: 10 },
  defaultSelectedDistricts: ['Kilifi', 'Kwale'],
  features: {
    regionBreakdown: {
      regions: ['Coast North', 'Coast South'],  // must match districtToRegion values above
      colors: { 'Coast North': '#F28F3B', 'Coast South': '#75ABBC' },
    },
    // homepageExtras: undefined,               // optional React component for country-specific UI
  },
};

const COUNTRY_REGISTRY: Record<string, CountryConfig> = {
  TZ: zanzibarConfig,
  KE: kenyaConfig,   // ← add this line
};
```

**Rules:**
- `districts` must contain the exact string values stored in `gaul_2_name` in your MongoDB.
- `districtToRegion` values and `regionBreakdown.regions` must be identical strings.
- `regionBreakdown` can have any number of regions (2, 3, or more).
- Set `regionBreakdown: undefined` if the country has no meaningful sub-regions.

---

## Step 2 — `gaul2-districts.ts`

**File**: `packages/nosql/src/constants/gaul2-districts.ts`

Update with the **same district and region data** as Step 1. This file is what the API
router (`getMonthlyRegionSummary`) uses to group database rows by region.

```ts
export const GAUL2_DISTRICT_NAMES = [
  'Kwale', 'Kilifi', 'Mombasa',    // same list as countryConfig.districts
] as const;

export type GAUL2DistrictName = (typeof GAUL2_DISTRICT_NAMES)[number];

export const GAUL2_TO_REGION: Record<string, string> = {
  'Kwale':   'Coast South',        // same mapping as countryConfig.districtToRegion
  'Kilifi':  'Coast North',
  'Mombasa': 'Coast North',
};
```

> **Why is this separate from `countries.ts`?**
> `packages/api` (the tRPC router) cannot import from `apps/isomorphic-i18n` (the Vite app)
> due to package boundaries. Both files carry the same data but serve different consumers:
> `gaul2-districts.ts` → API, `countryConfig` → UI.

---

## Step 3 — Locale files

For each language in your `languages` array, add:
```
apps/isomorphic-i18n/src/i18n/locales/<lang>/common.json
```

Copy from `locales/en/common.json` and update country-specific strings.
Strings to check: `metric-mean_rpue-unit`, `metric-mean_price_kg-unit` (currency label).

---

## Step 4 — Deployment env vars

```
VITE_COUNTRY_CODE=KE
MONGODB_URI=<your-kenya-cluster-connection-string>
MONGODB_URI_COASTS=<connection-string-of-the-database-holding-wio_gaul2>
AUTH_SECRET=<random-secret>
APP_URL=<the-deployment-public-url>
EMAIL_SERVER=<smtp-url>
EMAIL_FROM=<sender>
VITE_MAPBOX_TOKEN=<mapbox-token>
VITE_GA_MEASUREMENT_ID=<the-new-country-GA4-stream>
```

`VITE_COUNTRY_CODE` is inlined into the client bundle at build time (Vite exposes only
`VITE_*` variables to the browser), and the server reads the same variable at runtime.
A redeploy is required when changing it.

Each country reports into its own GA4 data stream, so the new deployment needs its own
`VITE_GA_MEASUREMENT_ID` plus a registered `peskas_country` custom dimension.
See [ANALYTICS.md](./ANALYTICS.md) for the GA4 admin steps.

---

## Checklist before deploying

- [ ] New entry in `COUNTRY_REGISTRY` in `countries.ts`
- [ ] `GAUL2_DISTRICT_NAMES` and `GAUL2_TO_REGION` updated in `gaul2-districts.ts`
- [ ] District names identical in both files and in the MongoDB `gaul_2_name` field
- [ ] Region names identical in `districtToRegion` (countryConfig) and `GAUL2_TO_REGION` (nosql)
- [ ] `regionBreakdown.regions` values match the region names used in `districtToRegion`
- [ ] Locale files added for each language
- [ ] Step 4 env vars (`VITE_COUNTRY_CODE`, `MONGODB_URI`, `MONGODB_URI_COASTS`, `AUTH_SECRET`, `APP_URL`, `EMAIL_SERVER`, `EMAIL_FROM`, `VITE_MAPBOX_TOKEN`) set in the deployment environment
- [ ] GA4 stream created and `VITE_GA_MEASUREMENT_ID` set on Production (see ANALYTICS.md)
- [ ] `pnpm tsc -b` passes in `apps/isomorphic-i18n/` and `pnpm tsc --noEmit` in `packages/api/`
