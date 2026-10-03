# Adding a Country to the Peskas Dashboard

Each country runs as a **separate deployment** pointing to its own MongoDB database.
Adding a country means one registry entry, locale files and the deployment's env vars
(Step 3; the full list is in `turbo.json`), with no other code changes.

---

## How country data flows

```
packages/domain/src/country.ts  (COUNTRY_REGISTRY, resolveCountry)
  ├─ vite.config.ts            title, description, Open Graph and GA tags
  ├─ app: activeCountry        districts, regions, map view, languages
  └─ api: activeCountry()      district list, district → region grouping, boundaries
```

The build, the browser and the tRPC server all resolve the same registry entry from
`VITE_COUNTRY_CODE`, so district and region names are written once.

---

## Step 1 — the registry entry

**File**: `packages/domain/src/country.ts`

Add an entry to `COUNTRY_REGISTRY`. Use the Zanzibar config as a template:

```ts
const kenyaConfig: CountryConfig = {
  countryCode: 'KE',                           // matches VITE_COUNTRY_CODE
  iso3Code: 'KEN',                              // wio_gaul2 boundaries are filtered by it
  countryName: 'Kenya',                         // used in page titles and analytics
  siteTitle: 'PESKAS | Kenya Fisheries',
  siteDescription: 'Peskas | Kenya Fisheries Dashboard',
  flagIconSrc: '/kenya-flag.svg',
  partner: { name: 'KEFS', logoSrc: '/kefs-logo.png', url: 'https://kefs.go.ke/' }, // top bar, beside the brand
  currencyCode: 'KES',                          // ISO 4217
  locale: 'sw-KE',                              // BCP 47, for the Open Graph locale
  languages: ['sw', 'en'],                      // locale folder names (Step 2); first is the fallback
  districts: ['Kwale', 'Kilifi', 'Mombasa'],   // exact gaul_2_name values in the summaries
  districtToRegion: {
    'Kwale':    'Coast South',
    'Kilifi':   'Coast North',
    'Mombasa':  'Coast North',
  },
  gridMapViewState: { longitude: 39.7, latitude: -2.0, zoom: 7, pitch: 0, bearing: 0 },
  survey: {},                                   // how the landing survey records the catch (see CountryConfig);
                                                // e.g. { pricedBySpecies: true } when each species has its own price
  features: {
    regionBreakdown: {
      regions: ['Coast North', 'Coast South'],  // display order in the district picker
    },
  },
};

export const COUNTRY_REGISTRY: Record<string, CountryConfig> = {
  TZ: zanzibarConfig,
  KE: kenyaConfig,
  MZ: mozambiqueConfig,   // ← add this line
};
```

**Rules**, checked by `pnpm --filter @repo/domain test`:
- `districts` holds the exact `gaul_2_name` values stored in the country's summaries.
- Every district has one region in `districtToRegion`.
- `regionBreakdown.regions` names exactly the regions of `districtToRegion`. A region whose name is a
  word rather than a place ("North") gets a `region-<name>` key in each locale file.
  Leave `regionBreakdown` out if the country has no meaningful regions.

---

## Step 2 — Locale files

For each language in your `languages` array, add:
```
apps/isomorphic-i18n/src/i18n/locales/<lang>/common.json
```

Copy from `locales/en/common.json` and update country-specific strings.
Strings to check: `metric-mean_rpue-unit`, `metric-mean_price_kg-unit` (currency label).
Add the Data and methods page's country facts, keyed by the country code, to every language, each
checked against the country pipeline rather than written from memory:
`methods-fact-survey-<CODE>` (who runs the survey), `methods-fact-recorded-<CODE>` (what the form
records), `methods-fact-weight-<CODE>` (weighed, or worked out from lengths or buckets),
`methods-update-<CODE>` (how often the pipeline runs; read its workflow cron) and
`methods-artfish-days-<CODE>` (which survey asks the FAO ARTFISH method's "days fished last week",
`fao.surveys` in the pipeline config, and since when).
Add `text-partner-<CODE>`, the line naming the organisation the dashboard is developed with in full:
Data and methods lists it first among the facts, and the partner's logo in the top bar shows it on hover.

---

## Step 3 — Deployment env vars

```
VITE_COUNTRY_CODE=KE
MONGODB_URI=<your-kenya-cluster-connection-string>
MONGODB_URI_COASTS=<connection-string-of-the-database-holding-wio_gaul2>
VITE_MAPBOX_TOKEN=<mapbox-token>
VITE_GA_MEASUREMENT_ID=<the-new-country-GA4-stream>
```

`VITE_COUNTRY_CODE` is inlined into the client bundle at build time (Vite exposes only
`VITE_*` variables to the browser), and the server reads the same variable at runtime.
A redeploy is required when changing it. An unknown code fails the build.

Each country reports into its own GA4 data stream, so the new deployment needs its own
`VITE_GA_MEASUREMENT_ID` plus a registered `peskas_country` custom dimension.
See [ANALYTICS.md](./ANALYTICS.md) for the GA4 admin steps.

---

## Checklist before deploying

- [ ] New entry in `COUNTRY_REGISTRY` in `packages/domain/src/country.ts`
- [ ] District names identical to the MongoDB `gaul_2_name` field
- [ ] `pnpm --filter @repo/domain test` passes
- [ ] Locale files added for each language
- [ ] Step 3 env vars (`VITE_COUNTRY_CODE`, `MONGODB_URI`, `MONGODB_URI_COASTS`, `VITE_MAPBOX_TOKEN`) set in the deployment environment
- [ ] GA4 stream created and `VITE_GA_MEASUREMENT_ID` set on Production (see ANALYTICS.md)
- [ ] `pnpm tsc -b` passes in `apps/isomorphic-i18n/` and `pnpm tsc --noEmit` in `packages/api/`
