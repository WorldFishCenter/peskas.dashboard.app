# AskFish Stage 3.3 — Kenya BMU source-grain activation

> **Stage 3.3:** Runtime exposure is limited to the two Kenya sources approved in Stage 3.2. Every rule below is fail-closed and does not authorize new cross-grain statistics.

## Activated datasets

- `kenya_bmu_monthly` → `app.catch_monthly` at `BMU × month`.
- `kenya_bmu_gear_monthly` → `app.gear_summaries` at `BMU × month × gear`.

Both expose exact stored `mean_effort`, `mean_cpue`, `mean_cpua`, `mean_rpue`, and `mean_rpua` values only. Stage 3.1B verified the physical grains but did not establish the upstream formulas/weights for these mean/rate measures.

## Hard runtime rules

1. Country must be Kenya.
2. The datasets have `pageScopes: []` and are queryable only with **Restrict OFF**.
3. BMU matching allows exact/case/punctuation normalization only; no prefix/fuzzy geographic matching and no BMU enumeration in error messages.
4. A monthly trend is allowed only for one explicit BMU and keeps one stored value per source-grain month.
5. BMU/gear comparisons and rankings require one explicit calendar month and must not reduce stored mean/rate values across BMU, time, or gear.
6. No `aggregateOver` operation is allowed for these datasets.
7. No implicit BMU ↔ portal district/GAUL-2 mapping or cross-frame join is allowed.
8. The query executor selects MongoDB from the catalog binding (`app` versus `portal-prod`); the browser/LLM never selects physical databases.
9. Suggested Questions omit these native datasets because suggestions have no user-supplied BMU anchor; typed questions can use them.
10. `app.fish_distribution` remains absent until Peskas identity/authorization propagation is implemented.

## Acceptance examples

Expected to work with Restrict OFF and real Kenya BMU names:

- `Show monthly CPUE for <BMU> over the last 12 months.`
- `How has RPUE changed at <BMU> month by month?`
- `Which BMU had the highest CPUE in July 2026?`
- `Compare nets and longline CPUE at <BMU> in July 2026.`
- `Which gear had the highest CPUE at <BMU> in July 2026?`
- `Compare CPUE between <BMU A> and <BMU B> in July 2026.`

Expected to remain blocked:

- `What was the average CPUE across all Kenya BMUs over the last year?`
- `Which BMU had the best average RPUE over the last six months?`
- `Combine this BMU result with the current portal district.`
- `Which Kenya landing site caught the most fish?`
