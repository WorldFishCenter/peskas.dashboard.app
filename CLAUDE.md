# peskas.dashboard

Multi-country Peskas fisheries portal: a Turborepo (pnpm) monorepo whose only app, `apps/isomorphic-i18n` (Vite SPA with React Router, a Nitro server for tRPC, Mongoose), reads the `portal-*` Mongo summaries that `peskas.coasts::export_portal` writes. One codebase, one Vercel project per country.
Ecosystem context (other repos, data flow, cross-repo contracts): see PESKAS.md, loaded via CLAUDE.local.md.

## Commands

- `pnpm install`, then `pnpm run i18n:dev` (Vite dev server on port 3001; it also serves the tRPC API through the Nitro Vite plugin).
- `pnpm run i18n:lint` / `pnpm run i18n:build`; `pnpm run lint` / `pnpm run build` for the whole workspace.
- Type-check: `pnpm tsc -b` in the app (also checks `vite.config.ts` and `server/`), `pnpm tsc --noEmit` inside a package. Lint is oxlint.
- Tests: `pnpm test` (vitest, Node 22.12+). `packages/domain` tests the country registry, the metric catalogue and the size indicators; `packages/api` tests the summary queries on an in-memory MongoDB (`mongodb-memory-server`, binary cached under `node_modules/.cache`).
- Check the monthly summaries connection and data: `packages/nosql/src/test-monthly.ts`.
- Releases: `.github/workflows/release.yml` publishes the top block of `NEWS.md` on push to `dev`.

## Architecture

- `packages/api/src/router/` holds the tRPC routers: `summaries.ts` is every portal summary query (one scope of districts and month window, typed rows in domain terms, coasts column names only there), plus `grid-summary.ts` and `gaul2-boundaries.ts`; `packages/nosql/src/schema/` the Mongoose models, `packages/ui` (`@workspace/ui`) the shadcn/ui components. Pages live in `apps/isomorphic-i18n/src/pages/`; the page table in `src/config/routes.ts` gives each its path, nav entry, title, header filters, metric picker (atom, options, gear metric) and lazy loader, and `src/router.tsx` builds the `/:lang` routes from it, as do the nav, the header title and the header filters. A new page is one table entry, its page file and its locale keys (dashboard pages share one sticky top header: `NavigationMenu` on desktop, `Sheet` on mobile); app compositions in `src/components/`, pure logic in `src/lib/` and jotai atoms in `src/store/`.
- The only server code in the app is `server/routes/api/trpc/[...].ts` (Nitro, `serverDir: ./server`); unmatched paths get `index.html`. Nitro is a pinned beta (`nitro/vite`, Vercel's recommended backend for Vite apps). Server code reads `process.env` inside functions, not at module top level.
- Every page and procedure is public; there is no sign-in (the user admin inherited from the Kenya BMU dashboard was removed). Procedures don't catch errors: the tRPC route's `onError` logs them and `errorFormatter` (`packages/api/src/trpc.ts`) hides internal messages from the browser.
- Env vars: the build list is in `turbo.json`; examples in `apps/isomorphic-i18n/.env.*.example`. Only `VITE_*` reach the browser (`import.meta.env`, typed in `src/vite-env.d.ts`). Two Mongo connections:
  - `MONGODB_URI` is the default connection (`packages/nosql/src/index.ts`): monthly, taxa, districts, gear, grid and length summaries, and taxa traits.
  - `MONGODB_URI_COASTS` is used only for `wio_gaul2` boundaries, via `getPortalDb` in the same file.
- `packages/domain` (`@repo/domain`) holds what the build, the browser and the server share, as data and pure functions only (no env, no I/O): `country.ts` (`COUNTRY_REGISTRY`, `resolveCountry`), `metrics.ts` (the metric catalogue: keys and how each combines across months and districts; landings thresholds and bands) and `sizes.ts` (length classes against maturity and optimum length, as ranges).
- `VITE_COUNTRY_CODE` (TZ/KE/MZ, default TZ; an unknown code throws) selects the country: the app resolves it at build time in `src/config/countryConfig.ts` (`activeCountry`), the server per call in `packages/api/src/lib/country.ts` (`activeCountry()`). The registry holds districts, colours, currency, map view state and the language list. Languages are set per country (the first entry is the fallback). Locale files are in `src/i18n/locales/<lang>/`.
- The `country-head` plugin in `vite.config.ts` writes the title, description, Open Graph tags and Google Analytics into `index.html`, another reason `@repo/domain` stays data-only.
- Adding a country: follow `apps/isomorphic-i18n/COUNTRY_SETUP.md`. For Google Analytics per deployment, see `apps/isomorphic-i18n/ANALYTICS.md`.
- Decision history: `docs/decisions.md`.

## UI (shadcn/ui)

- Build UI only from official shadcn/ui: base **Base UI** (compose with `render`, not `asChild`), preset `bJMUAev2` (style `base-nova`, base colour Stone, theme Cyan), Tailwind v4, lucide icons. Read the component's doc before using it: `https://ui.shadcn.com/docs/components/base/<name>.md`.
- Add components with `npx shadcn@latest add <name>` run inside `apps/isomorphic-i18n`; the CLI writes them to `packages/ui`. Never hand-edit or copy component files.
- The CLI drops component hooks (e.g. `use-mobile`) into the app's `src/hooks`, but the component imports `@workspace/ui/hooks/...`: move them to `packages/ui/src/hooks`.
- `shadcn apply` in this monorepo also writes a stray `apps/isomorphic-i18n/src/lib/utils.ts`: delete it. The font is `@fontsource-variable/inter`, imported in `packages/ui/src/styles/globals.css` as in the shadcn Vite template; `src/components/theme-provider.tsx` is that template's provider (no `next-themes`).
- Chart sizing follows the official shadcn chart examples: `CHART_HEIGHT` (`h-[250px]`) for wide charts and `categoryChartHeight(rows)` for horizontal bar charts so they grow with their categories. Chart cards use `Card size="sm"`.
- Every chart goes in `ChartCard` (`components/charts/chart-card.tsx`) with an `id` (CSV name and analytics), an `info` explanation (the locale key prefix `info-<name>` of its `-what/-how/-limits` keys, or `metricInfo`), its rows as `download`, and `scope` (usually `useDistrictScope()`) so its footer says the landings, districts, data month and sample size it rests on. Chart titles are the question the chart answers (`title-*` keys). Say whether a number is recorded or estimated, and never add up or average what the metric catalogue says not to. Tables render through `DataTable` (`components/data-table/data-table.tsx`).
- `recharts` is pinned to the chart registry's exact version in both `packages/ui` and the app; keep them identical or `ChartContainer` loses its context.
- An analysis card follows the district selection through `useDistrictScope()` (`store/filters.ts`: query input and `enabled`), wraps its chart in `ChartGate query={...}` (`components/charts/chart-state.tsx`: select-districts prompt, loading, error, empty, and a guard so a chart that throws blanks only itself) and takes hideable series from `useSeriesToggle` (`series-legend.tsx`). The home page ignores the district selection. A crash outside a chart shows the route's `RouteError` (`src/router.tsx`).
- District and species names contain spaces, so chart series get colours directly (`fill={color}`); `ChartConfig` carries labels only.
- Data tables use TanStack Table v9 (`useTable` + `tableFeatures`), per the shadcn Data Table guide.
- Base UI marks the current `NavigationMenuLink` with a bare `data-active` attribute, but the component styles `data-[active=true]`; style the active link with `data-active:` in app code (see `components/site-nav.tsx`).

## Rules

- Make every feature config-driven for all countries. Read country values from `activeCountry`, metric rules from `@repo/domain/metrics`, and never hard-code a district, currency, coordinates or a country code; how a country's survey records the catch lives in `activeCountry.survey`. Map centre/zoom comes from `activeCountry.gridMapViewState`.
- Fetch domain data in the UI through tRPC procedures. New summary queries go in `summaries.ts` and reuse its scope; read row types from `RouterOutputs` instead of redeclaring them.
- A month window is the current month plus the months before it, in UTC (`months`, all time when omitted). Month keys cross the wire as `YYYY-MM`; the app formats them in the page language.
- Add a key to every locale folder the active countries use.

## Gotchas

- Collection or column names come from `peskas.coasts` (`export_portal`). Renaming one there breaks the dashboard, and the reverse is also true.
- Every schema in `packages/nosql/src/schema/` maps a collection in the portal contract (PESKAS.md). Check that contract before adding a schema for any other collection.
- coasts' push (`mdb_collection_push`) adds a metadata document to every collection (`type: ["metadata"]`, `timestamp` of the push), with each field a one-element array. Queries filtered on `gaul_2_name` or `catch_taxon` skip it; `coverage` reads it for the last-update date.
