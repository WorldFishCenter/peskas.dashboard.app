// STAGE 3 STEP 3.3: Dependency-light regression checks pin the executable Kenya-native
// catalog and strict BMU category normalization without querying production MongoDB.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveExactSemanticCategoryValue } from "../apps/isomorphic-i18n/src/askfish/category-resolution";

const catalogPath = path.resolve(
  process.cwd(),
  "apps/isomorphic-i18n/src/askfish/semantic-catalog.json",
);
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

assert.equal(catalog.catalogVersion, "0.5.0");
for (const datasetId of ["kenya_bmu_monthly", "kenya_bmu_gear_monthly"]) {
  const dataset = catalog.datasets[datasetId];
  assert.equal(dataset.queryable, true);
  assert.deepEqual(dataset.pageScopes, []);
  assert.equal(dataset.bindings.KE.database, "app");
  assert.equal(dataset.geographicFrame.namespace, "kenya_bmu");
  assert.equal(dataset.measures.mean_cpue.rollups.acrossTime.status, "forbidden_source_grain_only");
  assert.equal(dataset.measures.mean_cpue.rollups.acrossBmu.status, "forbidden_source_grain_only");
}
assert.equal(catalog.datasets.kenya_bmu_monthly.bindings.KE.collection, "catch_monthly");
assert.equal(catalog.datasets.kenya_bmu_gear_monthly.bindings.KE.collection, "gear_summaries");
assert.equal(catalog.datasets.kenya_bmu_monthly.bindings.MZ, undefined);

const values = ["Example BMU", "Other BMU"];
assert.equal(resolveExactSemanticCategoryValue("example bmu", values).resolved, "Example BMU");
assert.equal(resolveExactSemanticCategoryValue("example-bmu", values).resolved, "Example BMU");
assert.equal(resolveExactSemanticCategoryValue("Example", values).resolved, null);

console.log("Stage 3.3 Kenya native-source regression passed.");
