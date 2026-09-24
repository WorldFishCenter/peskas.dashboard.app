# peskas.dashboard

Multi-country Peskas fisheries portal: a Turborepo (pnpm) monorepo whose only app, `apps/isomorphic-i18n` (Next.js App Router, tRPC, Mongoose, NextAuth), reads the `portal-*` Mongo summaries that `peskas.coasts::export_portal` writes. One codebase, one Vercel project per country.
Ecosystem context (other repos, data flow, cross-repo contracts): see PESKAS.md, loaded via CLAUDE.local.md.

## Commands

- `pnpm install`, then `pnpm run i18n:dev` (dashboard on port 3001).
- `pnpm run i18n:lint` / `pnpm run i18n:build`; `pnpm run lint` / `pnpm run build` for the whole workspace.
- Type-check a package: `pnpm tsc --noEmit` inside it (`packages/nosql` has a `typecheck` script).
- Check the monthly summaries connection and data: `packages/nosql/src/test-monthly.ts`.
- Releases: `.github/workflows/release.yml` publishes the top block of `NEWS.md` on push to `dev`.

## Architecture

- `packages/api/src/router/` holds the tRPC routers, `packages/nosql/src/schema/` the Mongoose models, `packages/isomorphic-core` the shared UI. Pages live under `apps/isomorphic-i18n/src/app/[lang]/(hydrogen)/`.
- Env vars: the build list is in `turbo.json`; examples in `apps/isomorphic-i18n/.env.*.example`. Two Mongo connections:
  - `MONGODB_URI` is the default connection (`packages/nosql/src/index.ts`): monthly, taxa, districts, gear and grid summaries.
  - `MONGODB_URI_COASTS` is used only for `wio_gaul2` boundaries, via `packages/nosql/src/portal-db.ts`.
- `NEXT_PUBLIC_COUNTRY_CODE` (TZ/KE/MZ, default TZ) selects the country at build time from `COUNTRY_REGISTRY` in `apps/isomorphic-i18n/src/config/countryConfig.ts`. That config holds districts, colours, currency, map view state and the language list. Languages are set per country (the first entry is the fallback). Locale files are in `src/app/i18n/locales/<lang>/`.
- Two layouts exist: Lithium (default, top nav) and Hydrogen (sidebar), switchable from the settings drawer.
- Adding a country: follow `apps/isomorphic-i18n/COUNTRY_SETUP.md`. For Google Analytics per deployment, see `apps/isomorphic-i18n/ANALYTICS.md`.
- Decision history: `docs/decisions.md`.

## Rules

- Make every feature config-driven for all countries. Read country values from `activeCountry` (`countryConfig.ts`), and never hard-code a district, currency or coordinates. Map centre/zoom comes from `activeCountry.mapViewState` / `gridMapViewState`.
- Fetch domain data in the UI through tRPC procedures, and reuse an existing router before adding aggregation logic.
- Add a key to every locale folder the active countries use.
- Keep schema changes in migrations under `packages/nosql/migrations/`.

## Gotchas

- `countryConfig.districtToRegion` must mirror `GAUL2_TO_REGION` in `packages/nosql/src/constants/gaul2-districts.ts`, because `packages/api` cannot import from `apps/`. If the region names differ, the homepage region bars render `-` and nothing reports an error.
- Collection or column names come from `peskas.coasts` (`export_portal`). Renaming one there breaks the dashboard, and the reverse is also true.
- Not every schema in `packages/nosql/src/schema/` matches a collection that coasts still writes (`individual_data`, `catch_monthly`, for example). The portal contract in PESKAS.md is the list to trust, so check it before building on any other collection.
