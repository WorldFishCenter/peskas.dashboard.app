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

- `packages/api/src/router/` holds the tRPC routers, `packages/nosql/src/schema/` the Mongoose models, `packages/ui` (`@workspace/ui`) the shadcn/ui components. Pages live under `apps/isomorphic-i18n/src/app/[lang]/(dashboard)/` (one sticky top header: `NavigationMenu` on desktop, `Sheet` on mobile) and `(auth)/`; app compositions in `src/components/`, pure logic in `src/lib/` and jotai atoms in `src/store/`.
- Env vars: the build list is in `turbo.json`; examples in `apps/isomorphic-i18n/.env.*.example`. Two Mongo connections:
  - `MONGODB_URI` is the default connection (`packages/nosql/src/index.ts`): monthly, taxa, districts, gear and grid summaries.
  - `MONGODB_URI_COASTS` is used only for `wio_gaul2` boundaries, via `packages/nosql/src/portal-db.ts`.
- `NEXT_PUBLIC_COUNTRY_CODE` (TZ/KE/MZ, default TZ) selects the country at build time from `COUNTRY_REGISTRY` in `apps/isomorphic-i18n/src/config/countryConfig.ts`. That config holds districts, colours, currency, map view state and the language list. Languages are set per country (the first entry is the fallback). Locale files are in `src/app/i18n/locales/<lang>/`.
- Adding a country: follow `apps/isomorphic-i18n/COUNTRY_SETUP.md`. For Google Analytics per deployment, see `apps/isomorphic-i18n/ANALYTICS.md`.
- Decision history: `docs/decisions.md`.

## UI (shadcn/ui)

- Build UI only from official shadcn/ui: base **Base UI** (compose with `render`, not `asChild`), preset `bJMUAev2` (style `base-nova`, base colour Stone, theme Cyan), Tailwind v4, lucide icons. Read the component's doc before using it: `https://ui.shadcn.com/docs/components/base/<name>.md`.
- Add components with `npx shadcn@latest add <name>` run inside `apps/isomorphic-i18n`; the CLI writes them to `packages/ui`. Never hand-edit or copy component files.
- The CLI drops component hooks (e.g. `use-mobile`) into the app's `src/hooks`, but the component imports `@workspace/ui/hooks/...`: move them to `packages/ui/src/hooks`.
- `shadcn apply` in this monorepo also writes a stray `apps/isomorphic-i18n/src/lib/utils.ts` and injects an unused Inter font into `src/app/layout.tsx` (the `<html>` lives in `[lang]/layout.tsx`, fonts in `src/app/fonts.ts`): delete both after applying a preset.
- Chart sizing follows the official shadcn chart examples: `CHART_HEIGHT` (`h-[250px]`) for wide charts, `mx-auto aspect-square max-h-[250px] w-full` for the radar, and `categoryChartHeight(rows)` for horizontal bar charts so they grow with their categories. Chart cards use `Card size="sm"`.
- `recharts` is pinned to the chart registry's exact version in both `packages/ui` and the app; keep them identical or `ChartContainer` loses its context.
- District and species names contain spaces, so chart series get colours directly (`fill={color}`); `ChartConfig` carries labels only.
- Notifications use Base UI `toast.add()` from `@workspace/ui/components/toast`, not sonner. Data tables use TanStack Table v9 (`useTable` + `tableFeatures`), per the shadcn Data Table guide.
- The filter atoms read `localStorage` on init, so the dashboard layout renders page content inside `ClientOnly` to avoid hydration mismatches.
- Base UI marks the current `NavigationMenuLink` with a bare `data-active` attribute, but the component styles `data-[active=true]`; style the active link with `data-active:` in app code (see `components/site-nav.tsx`).

## Rules

- Make every feature config-driven for all countries. Read country values from `activeCountry` (`countryConfig.ts`), and never hard-code a district, currency or coordinates. Map centre/zoom comes from `activeCountry.gridMapViewState`.
- Fetch domain data in the UI through tRPC procedures, and reuse an existing router before adding aggregation logic.
- Add a key to every locale folder the active countries use.
- Keep schema changes in migrations under `packages/nosql/migrations/`.

## Gotchas

- `countryConfig.districtToRegion` must mirror `GAUL2_TO_REGION` in `packages/nosql/src/constants/gaul2-districts.ts`, because `packages/api` cannot import from `apps/`. If the region names differ, the homepage region bars render `-` and nothing reports an error.
- Collection or column names come from `peskas.coasts` (`export_portal`). Renaming one there breaks the dashboard, and the reverse is also true.
- Not every schema in `packages/nosql/src/schema/` matches a collection that coasts still writes (`individual_data`, `catch_monthly`, for example). The portal contract in PESKAS.md is the list to trust, so check it before building on any other collection.
