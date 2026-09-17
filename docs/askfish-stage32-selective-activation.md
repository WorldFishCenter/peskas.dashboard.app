# AskFish Stage 3.2 — Source Classification and Selective Activation

> **Stage 3.2 note:** This document records the manual source-access and computation decisions made from the completed Stage 3.1A/3.1B evidence. It does **not** make any new source queryable at runtime; executable exposure is intentionally deferred to Stage 3.3.

## Decision summary

Stage 3.2 approves only two new native sources for a Stage 3.3 **source-grain-only** adapter:

- `KE/app.catch_monthly` at `BMU × month`.
- `KE/app.gear_summaries` at `BMU × month × gear`.

Both are approved only for exact stored observations. Cross-BMU and cross-time reductions of stored means/rates remain blocked because the upstream denominators/weights were not verified.

`KE/app.fish_distribution` has sufficiently strong grain/read-side aggregation evidence for future use, but it remains blocked because the existing Peskas route is protected and AskFish does not yet propagate user identity/authorization.

No Mozambique or Zanzibar native/deeper source is promoted in this cycle.

## Kenya decisions

### `app.catch_monthly` — approved for Stage 3.3 source-grain adapter

**Evidence reviewed**

- Physical grain `BMU × date` is duplicate-free across 1,540 analytical rows.
- `monthly_stats` overlaps on 210 BMU-month grains and matches `mean_effort`, `mean_cpue`, `mean_cpua`, `mean_rpue`, and `mean_rpua` exactly.
- Repository application access for the existing `aggregatedCatch.monthly` path is public.

**Allowed in Stage 3.3**

- Filter by an explicit BMU and time range.
- Return a monthly trend for one BMU without reducing across time.
- Compare multiple explicitly requested BMUs at the same month.
- Rank BMUs for one specific month when the user explicitly supplies/requests that month.

**Still forbidden**

- National/cross-BMU averages of `mean_*` measures.
- One-number averages across multiple months.
- Treating BMU as district/GAUL-2.
- Joining to portal district summaries without a verified BMU→GAUL-2 mapping.
- Claiming upstream derivation is scientifically verified.

### `app.gear_summaries` — approved for Stage 3.3 source-grain adapter

**Evidence reviewed**

- Physical grain `BMU × date × gear` is duplicate-free in the targeted 3.1B verification.
- Repository access is public.
- The source adds BMU-level gear detail not available from the harmonized district-level portal gear source.

**Allowed in Stage 3.3**

- Exact stored `mean_effort`, `mean_cpue`, `mean_cpua`, `mean_rpue`, and `mean_rpua` observations.
- Gear trend within one explicit BMU.
- Gear comparison within one explicit BMU/month.
- BMU comparison for one gear at one explicit month.

**Still forbidden**

- Reduction across BMUs.
- Reduction across time.
- Reconstructing catch/revenue totals from rate fields.
- Cross-frame joins to portal districts.

### `app.monthly_stats` — do not activate

The 3.1B reconciliation shows it is an exact overlapping mirror of `catch_monthly` for the tested measures. Activating both would add duplicate semantics without new analytical capability.

### `app.fish_distribution` — semantics approved, runtime blocked by identity

**Evidence reviewed**

- `landing_site × date × fish_category` is duplicate-free.
- 9,035 analytical rows contain numeric `total_catch_kg`.
- The existing Peskas read-side route explicitly sums `total_catch_kg` for category/time summaries.

**Decision**

Do not bypass the protected route with a service-level direct Mongo query. Activate only after AskFish propagates Peskas identity/authorization and the production access model is accepted.

### Other Kenya native sources — not selected

- `individual_stats`, `individual_gear_stats`, `individual_fish_distribution`: governance-blocked individual-level data.
- `map_distribution`: spatial/GPS-derived source; keep blocked pending explicit spatial governance.
- `legacy-metrics`: historical/legacy source; not required for the first fine-grained activation cycle.

## Mozambique decisions

### `pipeline.validated` — governance and derivation blocked

The submission-level fields tested are internally consistent within submissions, but the candidate detail grains still contain many duplicate groups. `total_catch_kg` equals summed `catch_kg` for only 87.37% of submission groups, while summed `catch_estimate` matches none. This is not strong enough to build a safe generic aggregate adapter.

The source also retains submission IDs and precise coordinates, so direct AskFish access remains prohibited independently of analytical usefulness.

### `mozambique-prod.monthly-metrics` — do not activate

The candidate `district × date × metric` grain is clean, but the tested CPUE, RPUE, price, fisher-count, and trip-duration formulas do not reconcile strongly enough with the audited validated source. A clean physical grain alone is insufficient to establish semantics.

### `mozambique-prod.taxa-sites` — do not activate

The `landing_site × catch_taxon` grain is clean, but tested `catch_kg` and `catch_percent` reconstructions have zero exact agreement on the matched groups. This indicates unresolved source scope/version/derivation differences.

### `mozambique-prod.sites-stats` — do not activate

The candidate landing-site grain contains a duplicate group, and none of the tested count/mean/rate formulas reconciles sufficiently for promotion.

### `mozambique-prod.taxa-length` — do not treat as aggregate summary

`catch_taxon × length_class` has 506 duplicate groups and up to 1,781 documents per group. The collection behaves like an observation/distribution table rather than one aggregate value per taxon-length bin.

## Zanzibar decisions

No native analytical source is promoted from `zanzibar-prod`. The audited collections are operational/QC (`surveys_flags`, `enumerators_stats`) and remain governance-blocked. Harmonized `portal-prod` remains the normal analytical route for Zanzibar.

## Stage 3.3 implementation contract

Stage 3.3 should add executable support for the two approved Kenya sources without weakening the existing portal catalog.

### New semantic datasets

Suggested internal IDs:

- `kenya_bmu_monthly`
- `kenya_bmu_gear_monthly`

### Hard runtime rules

1. Country must be Kenya.
2. These datasets are available only when dashboard restriction is OFF unless a future page explicitly uses the Kenya BMU frame.
3. User-supplied BMU filters are matched exactly/canonically, but BMU values are not bulk-enumerated into LLM prompts or audit outputs.
4. No implicit BMU↔district conversion.
5. `aggregateOver: district` must never be translated into BMU reduction.
6. Cross-BMU and cross-time rollups of the approved mean/rate measures are rejected by the catalog.
7. A trend is legal only when each plotted point is already one exact source-grain observation after filtering.
8. A comparison/ranking is legal only when all compared values share the same explicit month and require no rate/mean reduction.
9. Provenance must identify the native Kenya source, BMU geographic frame, exact grain, and `upstream_unverified` derivation status.
10. `fish_distribution` remains absent from the executable catalog until identity propagation is implemented.

## Stage 3.3 acceptance examples

These should become answerable after Stage 3.3 when an actual BMU name is supplied:

- “Show monthly CPUE for **<BMU>** over the last 12 months.”
- “How has RPUE changed at **<BMU>** month by month?”
- “Compare gillnet and longline CPUE at **<BMU>** in July 2026.”
- “Which gear had the highest CPUE at **<BMU>** in July 2026?”
- “Compare CPUE between **<BMU A>** and **<BMU B>** in July 2026.”

These must remain blocked:

- “What was the average CPUE across all Kenya BMUs over the last year?”
- “Which BMU had the best average RPUE over the last six months?”
- “Combine this BMU result with the current portal district.”
- “Which Kenya landing site caught the most fish?” (until protected `fish_distribution` identity propagation is implemented.)

## Stage 3.2 exit decision

Stage 3.2 is complete when this decision manifest is accepted. No AskFish/Peskas server restart is required because no runtime code or executable semantic catalog is changed in this stage.
