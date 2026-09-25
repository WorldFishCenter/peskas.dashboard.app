# Analytics — Google Analytics 4

Each country is a separate Vercel project serving its own domain, so each one reports
into its own GA4 data stream. Nothing in the code inspects the hostname; the split is
driven entirely by per-deployment environment variables.

---

## How it works

The `country-head` plugin in `vite.config.ts` writes the `gtag.js` snippet into the
`<head>` of `index.html` at build time (Vite's `transformIndexHtml` hook). No React code
loads or configures the tag.

| Concern | Behaviour |
|---|---|
| Which property receives data | `VITE_GA_MEASUREMENT_ID`, set per Vercel project |
| Platform-wide roll-up | `VITE_GA_ROLLUP_ID`, optional, same value on every project |
| Country label on every event | `peskas_country` / `peskas_country_code`, read from `src/config/countries.ts` |
| Page views on client-side navigation | Handled by GA4 enhanced measurement, not by app code |
| Local dev and preview deploys | Silent — no tag is written when no measurement ID is set |

### Why there is no `useEffect` page-view tracking

GA4 enhanced measurement already fires `page_view` on History API changes, which is how
React Router navigates. Sending our own `page_view` (or re-calling `gtag('config')`) on
route change **double-counts every navigation**. This is the single most common GA4 bug in
single-page apps, and it is why the app has no page-view code.

The trade-off: `page_title` is captured by GA4 at navigation time, which can occasionally
lag React's title update by a few hundred milliseconds. Use `page_location` / page path as
the reliable dimension in reports.

---

## Choosing the GA4 account structure

The application code is identical either way — one measurement ID per deployment. Pick
based on **who needs access to which numbers**.

### Option A — one property per country (recommended when partners get access)

Three GA4 properties, e.g. `Peskas Zanzibar`, `Peskas Kenya`, `Peskas Mozambique`.

- Fully siloed reports; no cross-contamination of totals, audiences, or conversions.
- Access control per country: a national fisheries partner can be granted their property
  without seeing the others.
- No built-in combined view — add the shared `VITE_GA_ROLLUP_ID` roll-up property
  (below) if you also want platform-wide numbers.

### Option B — one property, one web data stream per country

A single `Peskas` property with three streams, one per domain.

- Platform-wide reporting for free; break down by the built-in `Stream name` or `Hostname`
  dimension, or by `peskas_country`.
- Simpler admin: one set of custom dimensions, retention settings, and audiences.
- Standard reports **blend all three countries by default**, so every country-specific
  report needs a filter or comparison applied.
- Access is all-or-nothing: anyone with property access sees every country.

### The roll-up property

Setting `VITE_GA_ROLLUP_ID` to the same value on all three Vercel projects makes
`gtag` mirror every event into a second property, giving Option A a combined view as well.
Break it down by `peskas_country`. Leave the variable empty to disable.

> The pre-existing measurement ID `G-R8LTN94QRZ` was hardcoded and shared by all countries,
> so its historical data is already blended. It is the natural candidate for the roll-up
> property if you adopt Option A.

---

## Per-deployment environment variables

Set these in each Vercel project, **Production environment only** so that preview
deployments do not pollute the reports.

| Variable | Zanzibar | Kenya | Mozambique |
|---|---|---|---|
| `VITE_GA_MEASUREMENT_ID` | that country's stream | that country's stream | that country's stream |
| `VITE_GA_ROLLUP_ID` | same on all three, or unset | same | same |

Both are read at build time, so **changing either value requires a
redeploy**, not just an env update. Both are declared in the root `turbo.json` `env` list;
omitting them there would let Turborepo reuse one country's cached build for another.

---

## Required GA4 admin setup

Per data stream:

1. **Admin → Data streams → your stream → Enhanced measurement**: toggle on, and confirm
   **"Page changes based on browser history events"** is checked. Client-side navigation is
   not tracked without this.
2. **Admin → Data streams → Configure tag settings → Define internal traffic**: add a rule
   matching `*.vercel.app` so any preview traffic is classified as internal, then exclude
   internal traffic in the data filter.

Per property (including the roll-up — custom definitions are not shared between
properties):

3. **Admin → Custom definitions → Create custom dimension**, scope **Event**, for each
   parameter you want to report on: `peskas_country`, `peskas_country_code`, and the event
   parameters listed in the next section. GA4 only surfaces a custom parameter in reports
   once it is registered, and it does **not** backfill, so do this before you need the data.
   `district_count` is numeric and belongs on the **Custom metrics** tab instead, with unit
   **Standard**.

GA4 offers no import, copy, or bulk-create action for custom definitions, so rather than
repeating the list by hand in all four properties, run
[`scripts/ga4-custom-definitions.gs`](./scripts/ga4-custom-definitions.gs) — an Apps Script
that creates every definition through the Admin API. It is idempotent and defaults to a
dry run. Dimension display names are restricted to letters, digits, spaces and underscores
starting with a letter, and `parameterName` is immutable once created.

Note the built-in `Country` dimension is geographic (derived from IP) and is not the same
thing as `peskas_country`, which identifies the deployment. A user in Nairobi visiting the
Zanzibar dashboard has `Country = Kenya` and `peskas_country = Zanzibar`.

---

## Custom events

Fired through `trackEvent()` in `src/lib/analytics.ts`, which no-ops when the tag is not
loaded. Add new event names to the `AnalyticsEvent` union there so typos fail the build.

| Event | Parameters | Fired when |
|---|---|---|
| `filter_time_range_change` | `time_range` (`"3"`, `"6"`, `"12"`, `"all"`) | Header time range option picked |
| `filter_metric_change` | `metric`, `control_source` (`header` \| `district_widget`) | Metric picked in either control |
| `filter_district_change` | `action`, `district`, `peskas_region`, `district_count` | District selection changed |
| `map_basemap_change` | `basemap` (`satellite` \| `map`) | Basemap toggled on the grid map |
| `map_effort_range_toggle` | `effort_range`, `enabled` | Effort band toggled in the map info panel |

`filter_district_change.action` is one of `add`, `remove`, `clear`, `region_add` or
`region_remove`.
`district` is absent on region and clear actions; `peskas_region` is only present on region
actions.

Two parameter names avoid GA4 collisions deliberately. `control_source` is not `source`,
because `source` belongs to GA4's reserved UTM attribution family (`campaign`, `content`,
`medium`, `source`, `term`) and using it for custom data corrupts traffic-source reporting.
`peskas_region` is not `region`, because GA4 has a built-in geographic Region dimension and
ours means a fisheries region (Central / North / South).

Two deliberate choices in how these fire:

- **No event when nothing changed.** Re-picking the already-selected time range or metric,
  and deselecting the last remaining effort band (which the map rejects), are all
  suppressed. Without this the funnel is full of no-op "changes".
- **Nothing fires on mount, hydration, or navigation.** Only user gestures are tracked. In
  particular the district list is restored from `localStorage` and the metric is reset by
  route-driven effects in the header metric select (`components/filters/metric-select.tsx`);
  neither is a user action.

Continuous interactions are intentionally not tracked: map pan/zoom
(`onViewStateChange`) and hover tooltips would each produce hundreds of events per session
and blow through GA4 event quotas.

### Not instrumented: exports

There is no export or download feature in the fisheries dashboard today. When one is
added, fire a `data_export` event with the dataset and format.

---

## Verifying a deployment

1. Open the production domain and navigate between a few dashboard pages.
2. GA4 → **Reports → Realtime**: confirm the visit appears in the expected property.
3. Confirm the navigation count matches the number of pages you visited. Double the
   expected number means a second GA snippet is present, or manual page-view tracking was
   reintroduced alongside enhanced measurement.
4. GA4 → **Admin → DebugView** (with the GA Debugger extension) to inspect that
   `peskas_country` is attached to events.

To check event wiring without a GA property, run the app with any placeholder measurement
ID and read the queue in the browser console — `trackEvent` pushes through gtag, so
`window.dataLayer.filter((e) => e[0] === 'event')` shows exactly what would be sent.

---

## Not implemented

- **Cookie consent / Consent Mode v2.** The tag currently loads unconditionally. Users are
  primarily in TZ/KE/MZ, but EU-based funders and researchers do visit these dashboards. If
  consent is required, add `gtag('consent', 'default', ...)` as the first line of the init
  script in `vite.config.ts` (`countryHead`) — it must run before `gtag('config')` to take effect.
- **Cross-domain tracking.** Deliberately absent: the country dashboards are separate sites
  and a user is never expected to travel between them in one session. Enabling the domain
  linker would merge their sessions.
