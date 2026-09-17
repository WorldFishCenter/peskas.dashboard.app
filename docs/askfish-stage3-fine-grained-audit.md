# AskFish–Peskas Stage 3.1 revised fine-grained source audit

<!-- STAGE 3 STEP 3.1 REVISED: This stage changes no AskFish/Peskas runtime behavior and activates no source. -->
Stage 3.1 is the evidence gate before AskFish can query data below the harmonized `portal-prod` summary layer. It establishes live structural, privacy, geographic-frame, and duplicate evidence without exporting raw records. Passing this audit does **not** establish that a rate/mean can be re-aggregated.

## 1. Use a dedicated read-only MongoDB credential

<!-- STAGE 3 STEP 3.1 REVISED: Read-only must be enforced by MongoDB permissions, not merely by trusting the JavaScript to avoid writes. -->
Create/use a dedicated database user with the built-in `read` role only on the databases being audited. Do not use the normal application read-write user. The audit calls `connectionStatus` with privilege details and fails closed if known write/admin actions are present or if privileges cannot be verified.

<!-- STAGE 3 STEP 3.1 REVISED: A single audit user may receive read on the four target DBs, or separate country-specific read-only users may be used. -->
Target production databases:

1. Mozambique cluster → `pipeline`
2. Mozambique cluster → `mozambique-prod`
3. Kenya cluster → `app`
4. Zanzibar cluster → `zanzibar-prod`

## 2. Run the audit

<!-- STAGE 3 STEP 3.1 REVISED: `--quiet` and shell redirection keep the saved artifact limited to the sanitized JSON emitted by the script. -->
Example using a dedicated read-only user:

```bash
mongosh "mongodb+srv://<MOZAMBIQUE_CLUSTER>/pipeline" \
  --apiVersion 1 \
  --username askfish_audit_ro \
  --quiet \
  --file scripts/askfish-fine-grained-audit.js \
  > mozambique_pipeline_stage3_audit.json
```

<!-- STAGE 3 STEP 3.1 REVISED: Repeat against the other approved databases; the script refuses any database outside its allowlist. -->
Recommended output filenames:

```text
mozambique_pipeline_stage3_audit.json
mozambique_native_stage3_audit.json
kenya_app_stage3_audit.json
zanzibar_native_stage3_audit.json
```

## 3. Treat the four output JSONs as internal technical artifacts

<!-- STAGE 3 STEP 3.1 REVISED: Metadata can still reveal internal architecture or small vocabularies even when raw records/identifiers are excluded. -->
Do not commit the audit JSONs to the public repository and do not treat them as shareable/public data. Upload them only into the controlled AskFish review workflow needed for Stage 3.2.

## 4. What the audit exports

<!-- STAGE 3 STEP 3.1 REVISED: Collection-level evidence is sufficient for structural review without emitting record-level or small-group breakdowns. -->
The JSON contains:

- collection existence and approximate document counts;
- sampled top-level field names, BSON types, presence, and non-null coverage;
- collection-level BSON Date ranges;
- cardinality counts for selected geographic/semantic/identifier fields;
- identifier uniqueness ratios without identifier values;
- repository-supported candidate-grain duplicate summaries without grouped key values;
- potential sensitive, identifier, free-text, and nested-field names for human review;
- observed geographic field names with namespace/parent mapping explicitly marked `unverified`;
- source-access status and computation/rollup status as separate blocked decisions.

## 5. Cardinality-gated semantic vocabularies

<!-- STAGE 3 STEP 3.1 REVISED: Low-cardinality enumeration is allowed only for an explicit semantic allowlist and never for geographic/identifier fields. -->
Values are enumerated only for allowlisted semantic fields such as `metric`, `indicator`, `gear`, and `fish_category`, and only when the live distinct count is **50 or fewer** and the observed BSON types are scalar. Above the threshold the audit emits only:

```json
{
  "distinctCount": 287,
  "enumerated": false,
  "valuesSuppressed": true,
  "suppressionReason": "cardinality_above_50",
  "values": null
}
```

<!-- STAGE 3 STEP 3.1 REVISED: Geographic names and identifiers are never routed through semantic enumeration even when their cardinality is small. -->
BMU, landing-site, district, fisher/vessel/enumerator identifiers, GPS coordinates, and other geographic/identity values are count-only.

## 6. What the audit never exports

<!-- STAGE 3 STEP 3.1 REVISED: These exclusions reduce disclosure risk but do not replace the mandatory human governance gate. -->
The audit does not export:

- raw documents or sample rows;
- fisher/user/enumerator/vessel identifier values;
- BMU, landing-site, or district values;
- latitude/longitude/GPS values;
- names, contact details, tokens, passwords, or session content;
- free-text values from notes/comments/descriptions/messages;
- per-BMU, per-site, per-fisher, or other small-group date/count statistics;
- nested object/array values.

## 7. Human governance review remains mandatory

<!-- STAGE 3 STEP 3.1 REVISED: Name-based sensitivity detection is a heuristic, so high-risk sources fail closed even if no obvious PII-looking field is found. -->
Any `individual_*`, raw/preprocessed survey, GPS/tracker, fisher/vessel, enumerator/operational, free-text, or nested-record source remains `governance_blocked` until a human reviewer explicitly classifies it. A field such as `notes` can contain PII, and an identifier can appear under a name such as `f_id`; the script therefore never auto-promotes a source.

## 8. Geographic frame is a separate gate

<!-- STAGE 3 STEP 3.1 REVISED: Kenya BMU and landing-site data must not be silently blended with the portal district/GAUL-2 frame. -->
For example, repository evidence currently suggests:

```text
Kenya catch_monthly
→ BMU × date
→ geographic namespace: kenya_bmu
→ BMU → district mapping: UNVERIFIED

Kenya fish_distribution
→ landing_site × date × fish_category
→ geographic namespace: kenya_landing_site
→ landing_site → BMU/district mapping: UNVERIFIED
```

<!-- STAGE 3 STEP 3.1 REVISED: Cross-frame joins remain forbidden until an explicit mapping source and mapping quality are validated. -->
A BMU-level result can become a legitimate AskFish capability without pretending BMU is the same axis as `gaul_2_name`.

## 9. Source access and rollup legality are different decisions

<!-- STAGE 3 STEP 3.1 REVISED: Field discovery proves that a measure exists; it does not prove how that measure may be aggregated. -->
Stage 3.2 must answer two independent questions:

```text
Can AskFish READ this source?
Can AskFish AGGREGATE this measure over the requested dimensions?
```

<!-- STAGE 3 STEP 3.1 REVISED: Means/rates stay blocked until weighting/denominator semantics are established from derivation evidence. -->
For example, a successful audit may establish that Kenya `catch_monthly` contains `mean_cpue` at `BMU × date`. That can eventually permit retrieval/comparison of source-grain BMU values while **cross-BMU or cross-time mean CPUE remains blocked** until the upstream weighting rule is verified.

## 10. Derivation evidence required after the metadata audit

<!-- STAGE 3 STEP 3.1 REVISED: The pipeline/source repository is high-leverage evidence, but code alone is not enough to certify a production semantic contract. -->
For rates, means, estimated quantities, and other derived measures, activation should combine:

1. pipeline/source-code derivation;
2. the live fields/grain found by this audit;
3. a small numerical reconciliation against known production outputs.

<!-- STAGE 3 STEP 3.1 REVISED: This evidence is what can move catalog metadata from upstream_unverified to a verified derivation/rollup rule. -->
The review should establish units/currency, numerator/denominator or weight, stock-vs-flow semantics, allowed rollup dimensions, forbidden rollups, missing/zero treatment, and duplicate/version policy.

## 11. Live portal contract holes remain a parallel prerequisite

<!-- STAGE 3 STEP 3.1 REVISED: Deep-source discovery does not close unresolved contracts in the portal summaries AskFish already queries today. -->
Before or in parallel with Stage 3.2, close the remaining live-portal `pending_probe` items, especially:

- `gear_summaries` schema/country differences;
- country currency mappings;
- any other `pending_probe` entries still present in the executable catalog.

## 12. Stage 3.2 classification rule

<!-- STAGE 3 STEP 3.1 REVISED: Stage 3.2 classifies source access and computation independently rather than using one overloaded queryable flag. -->
Each source receives a source-access decision:

- `queryable_aggregate`
- `queryable_authenticated`
- `governance_blocked`
- `not_useful`
- `pending`

and an independent computation decision:

- `verified_rollups`
- `partial_verified_rollups`
- `derivation_blocked`
- `not_applicable`

<!-- STAGE 3 STEP 3.1 REVISED: A source may therefore be readable at its validated source grain while unsafe rollups remain blocked. -->
No audit result automatically changes the executable semantic catalog. Promotion requires human review plus an explicit later catalog change.
