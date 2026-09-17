/*
 * STAGE 2 STEP 2.7.1: Read-only acceptance probe for the harmonized production
 * portal contract. Run only against `portal-prod` with the dedicated audit user.
 * The script emits counts/ranges only: no district, gear, taxon, coordinate, ID,
 * or raw document values are exported.
 */

const EXPECTED_DATABASE = "portal-prod";

// STAGE 2 STEP 2.7.1: Candidate physical grains come directly from the audited live
// portal schemas. Duplicate counts verify whether canonicalization is merely defensive
// or actively resolving versioned rows in each production deployment.
const CONTRACTS = {
  monthly_summaries: {
    grain: ["date", "gaul_2_name", "metric"],
    analyticalFilter: {
      date: { $exists: true, $ne: null },
      gaul_2_name: { $exists: true, $ne: null },
      metric: { $exists: true, $ne: null },
      value: { $type: "number" },
    },
    dateField: "date",
  },
  districts_summaries: {
    grain: ["date", "gaul_2_name", "indicator"],
    analyticalFilter: {
      date: { $exists: true, $ne: null },
      gaul_2_name: { $exists: true, $ne: null },
      indicator: { $exists: true, $ne: null },
      value: { $type: "number" },
    },
    dateField: "date",
  },
  gear_summaries: {
    grain: ["date", "gaul_2_name", "gear", "indicator"],
    analyticalFilter: {
      date: { $exists: true, $ne: null },
      gaul_2_name: { $exists: true, $ne: null },
      gear: { $exists: true, $ne: null },
      indicator: { $exists: true, $ne: null },
      value: { $type: "number" },
    },
    dateField: "date",
  },
  taxa_summaries: {
    grain: ["date", "gaul_2_name", "catch_taxon", "metric"],
    analyticalFilter: {
      date: { $exists: true, $ne: null },
      gaul_2_name: { $exists: true, $ne: null },
      catch_taxon: { $exists: true, $ne: null },
      metric: { $exists: true, $ne: null },
      value: { $type: "number" },
    },
    dateField: "date",
  },
  grid_summaries: {
    grain: ["lat_grid_1km", "lng_grid_1km"],
    analyticalFilter: {
      lat_grid_1km: { $type: "number" },
      lng_grid_1km: { $type: "number" },
    },
    dateField: null,
  },
};

// STAGE 2 STEP 2.7.1: Fail closed unless the credential is read-only. `read` roles on
// multiple audit databases are acceptable; any non-read role aborts the verification.
function assertReadOnlyCredential() {
  const status = db.runCommand({ connectionStatus: 1, showPrivileges: true });
  const roles = status?.authInfo?.authenticatedUserRoles || [];
  const allowed = roles.every(
    (role) => role.role === "read" || (role.role === "readAnyDatabase" && role.db === "admin"),
  );
  if (!roles.length || !allowed) {
    throw new Error(
      `Stage 2.7 requires a dedicated read-only credential. Observed roles: ${roles
        .map((role) => `${role.db}.${role.role}`)
        .join(", ") || "none"}.`,
    );
  }
}

// STAGE 2 STEP 2.7.1: Group only by the declared grain and return aggregate duplicate
// counts. No group key values are projected into the output.
function duplicateProfile(collection, grain, match) {
  const groupId = Object.fromEntries(grain.map((field) => [field, `$${field}`]));
  const rows = collection
    .aggregate([
      { $match: match },
      { $group: { _id: groupId, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      {
        $group: {
          _id: null,
          duplicateGroups: { $sum: 1 },
          duplicateDocuments: { $sum: "$n" },
          maxDocumentsPerGroup: { $max: "$n" },
        },
      },
      { $project: { _id: 0 } },
    ])
    .toArray();
  return rows[0] || { duplicateGroups: 0, duplicateDocuments: 0, maxDocumentsPerGroup: 1 };
}

if (db.getName() !== EXPECTED_DATABASE) {
  throw new Error(`Stage 2.7 must run against '${EXPECTED_DATABASE}', not '${db.getName()}'.`);
}
assertReadOnlyCredential();

const result = {
  // STAGE 2 STEP 2.7.1: Version 1.1 clarifies that excluded rows include metadata,
  // null-valued observations, and incomplete grain rows; no user data are exported.
  verificationVersion: "1.1",
  generatedAt: new Date().toISOString(),
  database: db.getName(),
  handlingClassification: "internal_technical_audit",
  rawDocumentsExported: false,
  grainValuesExported: false,
  collections: [],
};

for (const [name, contract] of Object.entries(CONTRACTS)) {
  const collection = db.getCollection(name);
  const totalDocuments = collection.estimatedDocumentCount();
  const analyticalRows = collection.countDocuments(contract.analyticalFilter);
  const duplicates = duplicateProfile(collection, contract.grain, contract.analyticalFilter);

  // STAGE 2 STEP 2.7.1: Date ranges are collection-level only; no per-district or
  // per-species periods are emitted, avoiding small-group disclosure.
  let dateRange = null;
  if (contract.dateField) {
    const rangeRows = collection
      .aggregate([
        { $match: contract.analyticalFilter },
        {
          $group: {
            _id: null,
            min: { $min: `$${contract.dateField}` },
            max: { $max: `$${contract.dateField}` },
          },
        },
        { $project: { _id: 0 } },
      ])
      .toArray();
    dateRange = rangeRows[0] || null;
  }

  result.collections.push({
    name,
    declaredPhysicalGrain: contract.grain,
    totalDocuments,
    analyticalRows,
    // STAGE 2 STEP 2.7.1: This count is deliberately descriptive rather than a
    // metadata-document count: excluded records can be metadata/schema rows, null
    // requested values, or records missing one or more declared grain dimensions.
    excludedNonAnalyticalRows: Math.max(totalDocuments - analyticalRows, 0),
    duplicateCheck: duplicates,
    dateRange,
  });
}

print(EJSON.stringify(result, null, 2));
