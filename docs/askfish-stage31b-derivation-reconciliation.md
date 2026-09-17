# AskFish–Peskas Stage 3.1B derivation and reconciliation

<!-- STAGE 3 STEP 3.1B: This stage is evidence-only and changes no AskFish or Peskas runtime behavior. -->
Stage 3.1B follows the structural/governance audit from Stage 3.1A. Its purpose is to determine what the deeper stored measures actually mean, which dimensions may be reduced safely, and which questions must remain blocked before Stage 3.2 classifies sources for activation.

## What the repository already establishes

<!-- STAGE 3 STEP 3.1B: Currency is explicitly configured per deployment and no longer needs to be guessed from Mongo fields. -->
The active country configuration provides the currency contract directly: Zanzibar/Tanzania uses `TZS`, Kenya uses `KES`, and Mozambique uses `MZN`.

<!-- STAGE 3 STEP 3.1B: Read-side aggregation is evidence of dashboard behavior, not upstream derivation. -->
The dashboard repository also shows these existing read-side rules:

- `district-summary.ts` sums `n_submissions`, `estimated_catch_tn`, and `estimated_revenue` over a requested date range and takes arithmetic means for the other displayed indicators.
- `gear.ts` takes arithmetic means of stored portal `cpue`/`rpue` rows when producing gear comparisons.
- Kenya `aggregated-catch.ts` / `monthly-stats.ts` use arithmetic means of stored BMU/month mean-rate fields (`catch_monthly` and `monthly_stats`) for higher-level dashboard views.
- Kenya `fish-distribution.ts` explicitly sums `total_catch_kg` for category/time summaries.

<!-- STAGE 3 STEP 3.1B: This prevents read-side code from being mistaken for a scientific formula. -->
Those findings are enough to document **dashboard-compatible** behavior, but they do not reveal the original numerator/denominator, weighting, extrapolation, or validation logic used to create `mean_cpue`, `mean_rpue`, `estimated_catch_tn`, `estimated_revenue`, or the native Mozambique median metrics.

## Why a live reconciliation is still needed

<!-- STAGE 3 STEP 3.1B: Stage 3.1A established structure; Stage 3.1B now tests candidate relationships numerically without exporting raw data. -->
The new `scripts/askfish-stage31b-derivation-reconciliation.js` performs small, read-only production checks and emits only aggregate error/count diagnostics. It never exports BMU/site/district names, submission IDs, coordinates, or raw rows.

<!-- STAGE 3 STEP 3.1B: A numerical match is corroboration, not automatic semantic activation. -->
A high match ratio can show that a candidate formula is consistent with production outputs. It does **not** by itself prove scientific intent. If the pipeline transformation source code is unavailable, Stage 3.2 should classify such a result as corroborated/partial evidence rather than fully verified derivation.

## Kenya reconciliation

<!-- STAGE 3 STEP 3.1B: Kenya uses only the already-audited `app` database and requires no cross-frame portal join. -->
Run with the dedicated read-only audit user:

```bash
mongosh "mongodb+srv://<KENYA-CLUSTER>/app?retryWrites=true&w=majority&appName=kenya-cluster" \
  --apiVersion 1 \
  --username askfish_audit_ro \
  --quiet \
  --file scripts/askfish-stage31b-derivation-reconciliation.js \
  > kenya_stage31b_reconciliation.json
```

<!-- STAGE 3 STEP 3.1B: The Kenya output tests four evidence items without revealing BMUs or landing sites. -->
The output checks:

1. `catch_monthly` uniqueness at `BMU × date`;
2. overlapping `monthly_stats` versus `catch_monthly` stored values for `mean_effort`, `mean_cpue`, `mean_cpua`, `mean_rpue`, and `mean_rpua`;
3. `fish_distribution` uniqueness at `landing_site × date × fish_category` plus numeric `total_catch_kg` coverage;
4. the previously-unverified native `gear_summaries` candidate grain `BMU × date × gear`.

<!-- STAGE 3 STEP 3.1B: Kenya's BMU/landing-site frame remains deliberately separate from portal GAUL-2. -->
The script does **not** compare Kenya native BMUs/sites to portal districts because no verified BMU/site → GAUL-2 mapping exists yet.

## Mozambique reconciliation

<!-- STAGE 3 STEP 3.1B: Mozambique needs read access to both approved production databases because the validated detail and native summaries live separately. -->
Use a dedicated account with the built-in `read` role on **both** `pipeline` and `mozambique-prod`, then run:

```bash
mongosh "mongodb+srv://<MOZAMBIQUE-CLUSTER>/pipeline?retryWrites=true&w=majority" \
  --apiVersion 1 \
  --username askfish_audit_ro \
  --quiet \
  --file scripts/askfish-stage31b-derivation-reconciliation.js \
  > mozambique_stage31b_reconciliation.json
```

<!-- STAGE 3 STEP 3.1B: The first Mozambique check establishes whether validated detail rows behave as components beneath one submission. -->
The script groups `pipeline.validated` internally by `submission_id` and reports only aggregate diagnostics for:

- candidate detail grains `submission_id × catch_taxon × length_class` and `submission_id × catch_taxon × length_class × catch_outcome`;
- whether district/site/date/gear/total catch/fisher count/trip duration are constant within a submission;
- whether `total_catch_kg` agrees with `sum(catch_kg)` or `sum(catch_estimate)` across detail rows.

<!-- STAGE 3 STEP 3.1B: Several candidate formulas are compared because field names alone are not sufficient evidence. -->
For `mozambique-prod.monthly-metrics`, the script compares stored values against explicit candidate calculations from one-row-per-submission data, including:

- median CPUE from `total_catch_kg / (tot_fishers × trip_duration)`;
- alternative CPUE from summed `catch_kg` or summed `catch_estimate`;
- candidate RPUE from catch × price divided by fisher-hours;
- candidate price/kg statistics;
- sum/mean/median interpretations of `n_fishers`;
- mean/median interpretations of `trip_duration`;
- stored `n` versus the number of contributing submissions.

<!-- STAGE 3 STEP 3.1B: Native composition/site summaries are reconciled separately because they can support useful lower-grain capabilities later. -->
It also tests whether:

- `taxa-sites.catch_kg` equals summed validated `catch_kg` at `landing_site × catch_taxon`;
- `taxa-sites.catch_percent` equals that taxon's percentage of site catch;
- `sites-stats` fields match plausible one-submission-per-trip aggregates such as submission count, mean/median catch, mean/median CPUE, fisher count, trip duration, and weighted price/kg.

<!-- STAGE 3 STEP 3.1B: Sensitive validated fields remain blocked regardless of a successful numerical reconciliation. -->
Even if a formula matches perfectly, direct access to `pipeline.validated` remains governance-blocked because the audited source retains `submission_id` and precise coordinates. A later safe aggregate adapter may use it server-side only after Stage 3.2/3.3 explicitly defines the projection and access policy.

## Zanzibar reconciliation

<!-- STAGE 3 STEP 3.1B: Zanzibar's audited native production database has no normal analytical source to reconcile. -->
For completeness, run:

```bash
mongosh "mongodb+srv://<ZANZIBAR-CLUSTER>/zanzibar-prod?retryWrites=true&w=majority&appName=zanzibar" \
  --apiVersion 1 \
  --username askfish_audit_ro \
  --quiet \
  --file scripts/askfish-stage31b-derivation-reconciliation.js \
  > zanzibar_stage31b_reconciliation.json
```

<!-- STAGE 3 STEP 3.1B: The expected output is an explicit not-applicable result rather than probing QC/operational records. -->
This should report that analytical reconciliation is not applicable from the currently audited native sources (`surveys_flags`, `enumerators_stats`). Those remain governance-blocked.

## What to upload next

<!-- STAGE 3 STEP 3.1B: These three small JSON files are the complete live evidence needed for the next review. -->
Upload:

```text
kenya_stage31b_reconciliation.json
mozambique_stage31b_reconciliation.json
zanzibar_stage31b_reconciliation.json
```

<!-- STAGE 3 STEP 3.1B: Stage 3.2 starts only after interpreting these results together with the repository evidence registry. -->
After reviewing them, Stage 3.2 will classify **source READ permission** and **measure COMPUTE/rollup permission** independently. No source becomes queryable merely because this audit runs successfully.
