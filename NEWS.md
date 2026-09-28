# peskas.dashboard 2.2.0

## Clearer pages: the answer first, one district at a time

- Every page opens with its name, the question it answers, its filters, and one line saying how many landings, districts and months its figures rest on and when the data was last updated.
- The home page leads with what the surveyed landings show (catch rate, catch and revenue per trip, landings surveyed), each against the same months a year earlier. Estimated totals for all boats sit together with how confident they are; while few boats carry a tracker they are rounded and their change is not shown.
- Districts are compared in one ranked table with their change on a year earlier. Select a district to see it on its own. Districts with no surveyed landings are listed once instead of filling the table with dashes.
- On the Catch and Revenue pages, the figures at the top choose what the charts show: the selected districts as one line against the same months a year earlier, then each district in its own small chart on the same scale.
- Species show their common names. Species and sizes has three tabs: what is caught, at what size (with every measured species ranked by how much of its catch is below the size at which it first reproduces), and the food web.
- The Fishing gear page compares every gear in one table: how much it is used, what it catches and earns per hour, how much of its catch is below maturity size, and its main species.
- Vulnerable species opens with four figures. Data and methods draws how the figures are made and estimated, and sets out each survey, every measure and the chart symbols in one place each.
- A page's address keeps its time range, districts and measure, so a shared link opens the same view.
- The fishing-effort map shows the whole Mozambique coast legibly, in its own section.
- The fishing-effort map shows the same fishing activity as the Peskas Coasts regional map, for this country only: the hours boats spent fishing, told apart from travel, with the fishing grounds they keep returning to outlined. It opens tilted so the columns show their height, and hovering over a fishing ground highlights it and shows its figures.
- Pages print on landscape A4 with their time range and districts written on them.
- The top bar shows the partner the dashboard is developed with, by logo and name, beside the Peskas brand: ZAFIRI in Zanzibar, KEFS in Kenya and ADNAP in Mozambique, linked to their websites. Data and methods names the partner first.
- Data and methods and the chart explanations link the sources and organisations they name (FishBase, SeaLifeBase, the IUCN Red List, Pelagic Data Systems, the partner, the Peskas Management Platform). The Data and methods contact section sets out where to ask questions, the Peskas Management Platform for survey teams, the Peskas Fishery Data API and Peskas itself.

## Changes

- Every figure covers complete months: the current month is left out until its data is in, as the home page already did.
- Pages open on all the data (all time) rather than the last 6 months. Pick 3, 6 or 12 months to compare with the same months a year earlier.
- The month-by-month pattern (seasonality) appears once the selected districts have two years of data.
- Large numbers read "62 billion TZS" instead of "61,884.1M", in the page's language.
- Colours mean the same thing on every page and stay distinct for colour-blind readers; districts no longer have colours of their own.
- Mozambique opens on all its districts, like Zanzibar and Kenya.
- Buttons, links and the chosen figure look clickable, and popups and chart tooltips let the chart show through.
- Bars drawn in two shades (catch below maturity size, the vulnerability of a group of species) and the district panels have a legend, and the trend charts say how the districts are combined.

## Fixed

- Explanations checked against the pipelines that make the figures. Catch and revenue per unit effort are per hour of the trip as reported at landing, travel included, not per hour spent fishing. Length classes are described as they are (under 10 cm, then 5 cm wide to 30 cm, 10 cm to 1 m, wider above). Flagged records are said to be left out, without implying that a review brings them back. The size-at-maturity and gear explanations describe the charts they sit on.
- Months without data no longer show as dots along the top edge of the trend charts.
- The length chart draws each size class as wide as it is, so a wide class no longer looks like a large catch.
- In Kenya and Mozambique, the number of landings in a page's summary line now matches its figures.
- The species bar charts no longer repeat the species name in their tooltip.
- For estimated totals, the grey line behind each district panel is the average district rather than the sum of all districts, which flattened every district's line.
- Data and methods now says that species information covers the Western and Eastern Indian Ocean, that length classes widen above 30 cm, and that in Zanzibar and Mozambique the catch weight is worked out from fish lengths or buckets.

## Removed

- The stacked bars of species by district and by gear, and the four separate gear charts.

---

# peskas.dashboard 2.1.0

## Dashboards that explain themselves

- New Fishing gear page: which gears are used, how much they catch and earn per hour, and how much of their catch is smaller than the size at which the fish first reproduce.
- New Vulnerable species page: catch by vulnerability to fishing, sharks and rays, and each species' IUCN Red List and CITES status.
- The About page is now Data and methods: where the data comes from, how every figure is calculated and its limits, a glossary, and a table of landings surveyed per district and month.
- Every chart asks the question it answers, has an ⓘ button explaining what it shows, how it is calculated and what it cannot tell you, a button to download its data (CSV), and a line saying how many landings it rests on, the latest month of data and whether that sample is small, medium or large.
- The home page shows headline figures for complete months, compared with the same months a year earlier, and says how confident each estimate is.
- New figures: catch and revenue per trip, estimated fishing trips, price per kg by species, what each gear catches, the mean trophic level of the catch, and the size of the catch: how much is below the size at which each species first reproduces, at its optimum size, or large spawners.
- Figures resting on fewer than 10 landings carry a warning sign; in the time series they are drawn as hollow points and in the district table they are greyed out.
- Pages print cleanly.

## Changes

- Averages across districts, months and gears count each value by the landings behind it, so a district with 5 landings no longer weighs as much as one with 500.
- Seasonality is a month-by-district table over every year of data. With less than two years of it, the table says it shows a single year rather than a seasonal pattern.
- Gear performance is a ranked bar chart with the number of landings per gear, instead of a treemap.
- Catch by species is labelled as recorded catch: it comes from the surveyed landings, not the total catch.
- "No. of fishers" is now "Fishers per trip", which is what it always measured.
- The fishing-effort map opens flat and says that it covers all time and only boats with GPS trackers.
- The Kenya dashboard opens on every district: the three it opened on have had almost no surveys this year.
- On the Kenya dashboard the sizes of the catch are drawn from the average length of the fish measured on each landing, which is what its survey records; the charts and the Data and methods page say so.

## Removed

- The "length distribution" chart, which showed how district averages differed rather than the sizes of fish.
- The "Beta" labels.

---

# peskas.dashboard 2.0.0

## Redesign

- A new look: one top bar holds the page links, language and theme switch (a side menu on phones), leaving the full width to the charts.
- Light theme by default, with a switch to dark.
- Filters fold into a "Filters" button on small screens.
- Pages open faster, and switching between them is almost instant.
- The home page summary cards sit in one scrollable row and say they cover the last 3 months.
- The home page map is larger, with the district ranking beside it; its legends and explanation no longer cover the map.
- Chart legends are clickable: tap a district or species to hide or show it.

## Bug Fixes

- Catch composition now follows the selected time range.
- Catch composition showed a single month per district and species; it now covers the whole selected period.
- "Top N species" now means the N species with the most catch, not the first N alphabetically.
- The home page region cards add up their districts' catch, revenue, landings and fishers instead of averaging them.
- Seasonality charts under "All time" average every year of data and show month names in the page language.
- The map showed "NaN" for visit and cell counts above 1,000.
- The length chart tooltip printed "cm kg" for total catch.
- The species picker could not be reopened after "Clear all".
- The district table labelled revenue in Tanzanian shillings for every country.
- Time series left out districts with no value in the first month.
- Charts showed an error instead of a prompt when no district was selected.
- The district table said "no data" when loading failed; it now shows an error.
- The Mapbox attribution is shown on the map again.
- The metric picked on the home map no longer resets after visiting the catch page.
- A chart that fails to draw shows an error in its own card instead of blanking the page; other page errors offer a reload button.
- The "page not found" page is shown in the page language.

## Removed

- Sign-in, password reset and user administration: the dashboards are open and need no account.
- The Map page, which had no data to show.
- The unfinished "Ask Data" page, which was never in the menu.

---

# peskas.dashboard 1.4.0

## Security

- **User management endpoints were unauthenticated beyond "is logged in"**: `user.delete`
  and `user.upsert` ran on `protectedProcedure` with no permission check — the delete
  handler's only guard was that a session carried an email, under a comment claiming it
  verified admin privileges. Any signed-in user could delete or modify any account,
  including changing their own group. Both now call `assertPermission()`. Existing
  administrators are unaffected: the "Manage users" menu entry was already gated on a
  stricter check (all of create/read/update/delete), so anyone who could see the link
  passes the narrower server-side checks.

- **File uploads accepted anonymous requests**: `/api/uploadthing` shipped the template's
  placeholder `const auth = (req) => ({ id: 'fakeId' })`, so both upload routes — including
  one accepting 256 MB video — were open to the public internet against the deployment's
  storage quota. The middleware now requires a NextAuth session.

- **Deactivated accounts could still sign in**: the `status === "inactive"` check sat after
  the successful-password `return` in the credentials provider, so it never ran for a valid
  password. It only fired on a *wrong* password, where it also leaked account status to an
  unauthenticated caller. The check now runs before the password is compared.

- **Single permission implementation**: `hasPermission()` moved from
  `apps/isomorphic-i18n/src/helpers/auth.ts` into `packages/api/src/lib/permissions.ts`, so
  the tRPC procedures and the UI read the same function. Previously only the UI had one,
  which is how the menu and the API came to disagree.

## Bug Fixes

- **Password reset emails linked to a different application**: the reset link hardcoded
  `https://peskas-next-umber.vercel.app` whenever `NODE_ENV === 'production'`, sending every
  country's users to an unrelated deployment. The base URL is now derived from
  `NEXTAUTH_URL`, falling back to `VERCEL_URL`, so each deployment links to itself.

- **Passwords were hashed twice**: `user.upsert` set `password` twice in one object literal —
  a cost-12 hash that was immediately overwritten by a cost-10 `hashSync`. The cost-12 work
  was computed and discarded, and the stored hash was the weaker one. Now hashed once at
  cost 12, and only when a password was actually supplied.

- **Social previews advertised the template**: `metaObject()` still returned
  `"Isomorphic Furyroad"` as the OpenGraph title suffix and site name, pointed `url` at
  `isomorphic-furyroad.vercel.app`, and served the template's banner from RedQ's S3 bucket.
  It now derives everything from `activeCountry`, so each country's link previews carry its
  own title, description, and locale.

- **`user.byId` crashed for users with no group**: `user?.groups[0].name` threw a TypeError
  once optional chaining short-circuited past the array index. Now `user?.groups?.[0]?.name`.

- **Middleware matched locales that do not exist**: the matcher listed `de|es|ar|he|zh`
  alongside the three real locales, routing requests for languages with no translation
  files. Trimmed to `en|sw|pt`.

- **`ask-data` page title hardcoded Zanzibar**: read `"Ask Data | Peskas Zanzibar"` on every
  deployment; now goes through `metaObject()`.

## Removed

- **Two unused applications**: `apps/isomorphic` and `apps/isomorphic-starter` were template
  variants with no deployment from this repository — confirmed against Vercel, where all
  three live projects (`peskas-dashboard-{zanzibar,kenya,mozambique}`) build
  `apps/isomorphic-i18n`. `apps/isomorphic` continues to exist in the separate `peskas-next`
  repository, so nothing is lost.

- **Cross-package imports reaching into a deleted app**: `packages/isomorphic-core` imported
  *upward* into `apps/isomorphic` from three files via relative paths. Two of them were
  reachable from the deployed app, so deleting the app without severing these first would
  have broken the build. `utils/uploadthing.ts` now takes its `OurFileRouter` type from the
  surviving app; `get-status-badge.tsx` and `product-classic-card.tsx` were themselves dead
  and were removed.

- **Four template layouts**: Carbon, Beryllium, Helium, and Boron still carried the
  boilerplate's navigation (File Manager, Widgets, Newsletter) and were reachable through
  the settings drawer, giving users a route into template pages. `LAYOUT_OPTIONS` is now
  `HYDROGEN` and `LITHIUM` only. Note that Lithium — not Hydrogen — has always been the
  default that users see, despite the route group being named `(hydrogen)`; a stale
  `isomorphic-layout` value in `localStorage` now falls back to Lithium.

- **Template routes**: `/groups/*` (five stubs rendering literal strings like "AIA"),
  `/auth/sign-in-1..5` and `/auth/sign-up-1..5`, `/widgets/cards`, `/widgets/charts`,
  `/forms/newsletter`, `/file` (an exact duplicate of the home page), and the
  `profile-settings` sub-pages for team, billing, integration, and password.

- **1,415 files, roughly 140,000 lines** in total, including 357 files that only became
  unreachable once the above were gone. Source files under `apps/` and `packages/` dropped
  from 754 to 320. Dead code was identified with an import-reachability walk from the real
  Next.js entry points, checked against runtime `import()` references rather than static
  imports alone — the icon set in `isomorphic-core`, for example, was kept alive solely by a
  template gallery page loading `./icons/${fileName}` at runtime.

- **`tsconfig.tsbuildinfo` untracked**: a 2.2 MB TypeScript build artifact was committed to
  the repository. Added to `.gitignore`.

## Improvements

- **Catch and revenue charts share one implementation**: `catch-time-series` /
  `revenue-time-series` and `catch-radar` / `revenue-radar` were near-identical copies that
  had drifted apart — the catch charts had responsive mobile margins but formatted tooltip
  values with a raw `toFixed(2)`, while the revenue charts ran values through
  `formatDashboardNumber()` and formatted their axes but ignored mobile viewports. They are
  now `metric-time-series` and `metric-radar`, parameterised by the metric the page passes
  in, keeping the better behaviour from each. Shared loading, error, empty, tooltip, and
  legend-toggle logic moved to `charts/chart-common.tsx`. The `/revenue` route bundle fell
  from 5.97 kB to 649 B as a result.

- **Mail service tidied**: removed the `inviteProvider` template — declared but with no
  `.hbs` file, so any use would have thrown — along with its "Please sign up for Rheumote
  Control" subject line and a hardcoded `declan@mountaindev.com` address, both leftovers
  from an unrelated product. `prepTemplate()` and `getTemplate()` no longer duplicate the
  same read-and-cache block. Deleted the unreferenced `resetPasswordAdmin.hbs`.

- **Root layout and tRPC context**: the root layout imported five modules it never used
  (its body is just `return children`). `createTRPCContext` computed `ip` as
  `xForwardedFor ?? xRealIp` where the left operand had already been defaulted to
  `"unknown"`, making the fallback unreachable; it also read an `x-global-filters` header
  that was never used.

- **Documentation**: `CLAUDE.md` updated to describe the single application, the two
  remaining layouts, and the correct dashboard source path.

---

# peskas.dashboard 1.3.1

## Analytics

- **Per-country Google Analytics**: The GA4 measurement ID is now read from
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` per deployment instead of being hardcoded, so each
  country domain reports into its own GA4 property. An optional `NEXT_PUBLIC_GA_ROLLUP_ID`,
  set to the same value on every deployment, mirrors events into a shared property for a
  platform-wide view. Both are declared in `turbo.json` — without that, Turborepo could
  reuse one country's cached build for another and ship the wrong measurement ID.

- **Country dimension on every event**: `peskas_country` and `peskas_country_code` are
  attached globally via `gtag('set')` before `gtag('config')`, so even a shared property can
  be broken down by country. Both must be registered as event-scoped custom dimensions in
  GA4, which does not backfill them.

- **Fixed double-counted page views**: The analytics component re-fired `gtag('config')` on
  every route change while GA4 enhanced measurement was already tracking History API
  navigations, counting each client-side navigation twice. Page views are now left to
  enhanced measurement alone. Historical page-view figures are inflated.

- **Analytics component is now a Server Component**: Dropping the `usePathname()` /
  `useSearchParams()` hooks also removed an unrelated problem — `useSearchParams()` in the
  root layout with no `<Suspense>` boundary opted statically generated pages into
  client-side rendering.

- **Custom event tracking**: Five events cover the filter and map controls:
  `filter_time_range_change`, `filter_metric_change`, `filter_district_change`,
  `map_basemap_change`, and `map_effort_range_toggle`. They fire through a typed
  `trackEvent()` helper in `src/lib/analytics.ts` that no-ops when no measurement ID is set.
  Events are suppressed when a control is re-set to its current value, and nothing fires on
  mount, hydration, or route-driven state resets.

- **Analytics documentation**: New `apps/isomorphic-i18n/ANALYTICS.md` covers the GA4
  account structure options, required admin setup, the event and parameter reference, and
  verification steps. `COUNTRY_SETUP.md` now includes the analytics step when adding a
  country.

---

# peskas.dashboard 1.3.0

## Infrastructure

- **Multi-country deployment**: Each country (TZ, KE, MZ) deploys as a separate Vercel project
  from the same repository, with `NEXT_PUBLIC_COUNTRY_CODE` and `MONGODB_URI` as the only
  per-project env vars. `MONGODB_URI_COASTS` is shared across all deployments.

- **Fixed `NEXT_PUBLIC_COUNTRY_CODE`**: Renamed env var from `COUNTRY_CODE` to
  `NEXT_PUBLIC_COUNTRY_CODE`. The previous name was `undefined` in all client components
  (Next.js only exposes `NEXT_PUBLIC_*` vars to the browser bundle), causing the app to
  always fall back to Zanzibar regardless of which country was configured.

- **`gaul2-districts.ts` registry pattern**: Refactored `packages/nosql/src/constants/gaul2-districts.ts`
  to use the same three-country registry pattern as `countryConfig.ts`. Previously only Zanzibar
  data was exported; Kenya and Mozambique were commented out, breaking the district-summary
  API router for those countries.

- **Project renamed**: Project renamed from `peskas.zanzibar.v2` to `peskas.dashboard` to
  reflect its multi-country scope.

---

# peskas.dashboard 1.2.0

## New Features

- **GAUL2 choropleth map**: Homepage map now overlays administrative district boundaries
  colour-coded by the currently selected metric (CPUE, RPUE, catch tonnage, estimated
  revenue, or submission count). Boundaries are fetched from a separate portal MongoDB
  database (`wio_gaul2` collection) via a new `MONGODB_URI_COASTS` environment variable.
  Colour scale uses a 6-stop sequential Blues palette linearly interpolated across the
  district value range; districts with no data render in grey. The choropleth reacts in
  real-time to both the metric dropdown and the time range selector.

- **Choropleth tooltip**: Hovering a district polygon on the homepage map shows the
  district name and the selected metric value, formatted with the active locale.

- **Choropleth legend**: The map info panel displays the metric label and a colour ramp
  with min/max values when boundary data is loaded.

## Improvements

- **Shared metric state**: `district-summary-bar.tsx` metric selection is now driven by
  the shared `selectedMetricAtom` (Jotai) instead of local `useState`. The bar chart
  and the choropleth map always reflect the same metric selection.

- **Shared date range utility**: Extracted `computeDateRange()` into `dashboard/utils.ts`.
  Both the district summary bar and the choropleth map use it, eliminating duplicated
  inline date computation.

- **Multi-country boundaries**: `countryConfig.ts` extended with an `iso3Code` field
  (`'TZA'` / `'KEN'` / `'MOZ'`). The choropleth queries boundaries for the active
  country automatically — no code change needed when switching deployments.

- **New tRPC router**: `gaul2Boundaries.getByCountry` — queries `wio_gaul2` across all
  known field name variants (alpha-2 and alpha-3 ISO codes, `iso3_code` / `country` /
  nested `properties.*` fields) with a JS-filter fallback for non-standard documents.
  Returns a standard GeoJSON `FeatureCollection`.

- **Isolated portal DB connection**: `packages/nosql/src/portal-db.ts` manages a
  separate Mongoose connection (`mongoose.createConnection()`) for the portal database,
  fully isolated from the main fisheries DB connection.

---

# peskas.dashboard 1.1.0

## Improvements

- **Navigation**: Removed template artifacts (Groups, Widgets menus; ~130 dead route definitions).
  Routes trimmed to fisheries-only (`catch`, `revenue`, `catch_composition`, `map`, `ask_data`,
  `about`, `settings`, `forms.*`). Duplicate `nav-charts` bug fixed.

- **Dashboard components**: Deleted 23 dead component files (0 imports each). Renamed remaining
  components to kebab-case with descriptive names: `metric-cards`, `district-summary-bar`,
  `district-metrics-table`. `index.tsx` cleaned of dead imports and commented-out code.

- **Type safety**: `MetricBarCard` props fully typed (`MetricConfigEntry`, `MetricDataPoint`,
  `MonthlyRegionData`); removed `any` annotations. Badge configuration moved to `DropdownItemType`
  (`badge?: 'beta' | 'soon'`) instead of fragile string-key checks.

- **i18n**: Added `text-district-metrics`, `text-coming-soon`, `text-feature-under-development`
  keys in both English and Swahili. Nav keys (`nav-settings`, `nav-catch-overview`) aligned.
  New `ComingSoonPlaceholder` client component for placeholder pages.

- **Code quality**: `'use client'` directives made explicit; `lang!` assertions replaced with
  `lang ?? 'en'` throughout; unused imports removed.

---

# peskas.dashboard 1.0.0

## Major Changes

- **Multi-country dashboard**: Internationalized Next.js dashboard (apps/isomorphic-i18n)
  for Peskas fisheries deployments. Country is selected via `COUNTRY_CODE` at build
  time; each deployment uses its own config in `countryConfig.ts` and MongoDB,
  with no code fork required.

- **Unified time range for charts**: Navbar time range selector drives all time-based
  charts. Radar (catch and revenue seasonality) now use the same time range as time
  series and treemaps instead of a hardcoded year.

## Improvements

- **Navigation**: Ask Data, Settings, and Map entries can be hidden from nav and
  search (Hydrogen, Lithium, Boron layouts and page-links) for country-specific
  deployments.

- **API**: `monthlySummary.radarData` accepts a `months` parameter (date range)
  instead of a single `year`, returning an array of month-labeled points for the
  selected range. Month labels include the year when the range spans two years.

- **Documentation**: Added `COUNTRY_SETUP.md` for adding a new country to the
  dashboard (config, env, locales, deploy).

## Bug Fixes

- None in this release.

---

# peskas.dashboard 0.1.0

## New Features

- Turborepo monorepo with Next.js 14+ App Router, tRPC API, and MongoDB (nosql).
- Fisheries dashboard with catch, revenue, catch composition, district filters,
  and time range selector.
- Multiple layout themes (Hydrogen, Lithium, Carbon, Beryllium, Boron).
- Shared packages: isomorphic-core (UI), api (tRPC routers), nosql (schemas).

## Improvements

- Tailwind CSS styling; type-safe tRPC procedures; NextAuth integration.
