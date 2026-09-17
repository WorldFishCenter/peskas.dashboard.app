// STAGE 3 STEP 3.1 REVISED: Read-only, metadata-only fine-grained Peskas audit for AskFish.
// Run with mongosh against one approved production database at a time using a dedicated
// read-only credential. The script fails closed when it detects write-capable privileges.

// STAGE 3 STEP 3.1 REVISED: Version the audit contract so Stage 3.2 can reject stale outputs.
const AUDIT_VERSION = "1.1";
const SAMPLE_LIMIT = 1000;
const MAX_ENUM_CARDINALITY = 50;

/// STAGE 2.7 + STAGE 3.1: Explicitly allow the harmonized production portal
// database as a separate contract-audit target. Only analytical collections
// already used by the Peskas portal are inspected; auth/session collections
// remain outside the audit allowlist.
const TARGETS = {
  "portal-prod": [
    "monthly_summaries",
    "districts_summaries",
    "gear_summaries",
    "taxa_summaries",
    "grid_summaries",
  ],

  pipeline: ["raw", "preprocessed", "validated"],

  "mozambique-prod": [
    "monthly-metrics",
    "taxa-length",
    "taxa-sites",
    "surveys-gps",
    "sites-stats",
    "geo-indicators",
    "gear_habitat_metrics",
  ],

  app: [
    "catch_monthly",
    "fish_distribution",
    "individual_stats",
    "individual_gear_stats",
    "individual_fish_distribution",
    "gear_summaries",
    "map_distribution",
    "monthly_stats",
    "legacy-metrics",
  ],

  "zanzibar-prod": ["enumerators_stats", "surveys_flags"],
};

// STAGE 3 STEP 3.1 REVISED: Candidate grains supported by repository evidence are
// checked only for duplicate counts. The grouped key values themselves are never emitted.
const REPO_CANDIDATE_GRAINS = {
  catch_monthly: [["BMU", "date"]],
  fish_distribution: [["landing_site", "date", "fish_category"]],
};

// STAGE 3 STEP 3.1 REVISED: Geographic fields are profiled by cardinality only. The
// namespace/parent relationship is intentionally NOT inferred from field names.
const GEOGRAPHIC_FIELDS = new Set([
  "district",
  "gaul_2_name",
  "BMU",
  "bmu",
  "landing_site",
  "landingSite",
  "site",
  "site_name",
]);

// STAGE 3 STEP 3.1 REVISED: Only explicitly non-personal semantic vocabularies are
// candidates for value enumeration, and even these are suppressed above the threshold.
const SAFE_ENUM_FIELDS = new Set([
  "metric",
  "indicator",
  "gear",
  "fish_category",
  "catch_taxon",
  "common_name",
]);

// STAGE 3 STEP 3.1 REVISED: Cardinality is useful for grain discovery without exposing
// values. Identifier/geographic fields remain count-only regardless of low cardinality.
const CARDINALITY_FIELDS = new Set([
  ...GEOGRAPHIC_FIELDS,
  "gear",
  "fish_category",
  "catch_taxon",
  "common_name",
  "trip_id",
  "tripId",
  "survey_id",
  "surveyId",
  "fisher_id",
  "fisherId",
  "vessel_id",
  "vesselId",
  "enumerator_id",
  "enumeratorId",
]);

// STAGE 3 STEP 3.1 REVISED: Reject credentials with known write/admin privileges.
// This makes read-only behavior a property of both the script and the active credential.
const WRITE_CAPABLE_ACTIONS = new Set([
  "insert",
  "update",
  "remove",
  "bypassDocumentValidation",
  "createCollection",
  "createIndex",
  "dropCollection",
  "dropDatabase",
  "dropIndex",
  "renameCollectionSameDB",
  "convertToCapped",
  "collMod",
  "compact",
  "reIndex",
  "createUser",
  "updateUser",
  "dropUser",
  "dropAllUsersFromDatabase",
  "createRole",
  "updateRole",
  "dropRole",
  "dropAllRolesFromDatabase",
  "grantRole",
  "revokeRole",
  "grantPrivilegesToRole",
  "revokePrivilegesFromRole",
  "setAuthenticationRestriction",
  "enableSharding",
  "moveChunk",
  "moveRange",
  "splitChunk",
  "splitVector",
  "addShard",
  "removeShard",
  "shutdown",
]);

// STAGE 3 STEP 3.1 REVISED: Sensitive-name detection is only a screening heuristic.
// Human governance review remains mandatory for individual/raw/GPS/enumerator sources.
function looksSensitive(field) {
  return /(name|email|phone|token|password|secret|session|fisher|enumerator|user|person|vessel|boat|device|tracker|gps|coordinate|latitude|longitude|(^|_)lat($|_)|(^|_)lon(g)?($|_)|(^|_)lng($|_)|address)/i.test(field);
}

// STAGE 3 STEP 3.1 REVISED: Free-text fields can contain hidden PII even when their
// names are innocuous, so they are flagged for manual inspection without exporting text.
function looksLikeFreeText(field) {
  return /(note|notes|comment|comments|remark|remarks|description|message|messages|free.?text|observation|observations)/i.test(field);
}

// STAGE 3 STEP 3.1 REVISED: Identifier detection includes generic suffixes such as
// f_id because name-based PII screening alone is not sufficient.
function looksLikeIdentifier(field) {
  return /(^|_)(id|uuid|key)($|_)/i.test(field) || /(Id|ID|Uuid|UUID)$/.test(field);
}

// STAGE 3 STEP 3.1 REVISED: Confirm that the active Mongo credential is not
// write-capable. If privileges cannot be inspected, fail closed rather than assuming safety.
function assertReadOnlyCredential() {
  let status;
  try {
    status = db.getSiblingDB("admin").runCommand({ connectionStatus: 1, showPrivileges: true });
  } catch (error) {
    throw new Error(
      "Stage 3.1 requires a dedicated read-only credential whose privileges can be " +
        "verified with connectionStatus. Privilege inspection failed: " + error.message,
    );
  }

  const authInfo = status && status.authInfo;
  const privileges = (authInfo && authInfo.authenticatedUserPrivileges) || [];
  const roles = (authInfo && authInfo.authenticatedUserRoles) || [];

  if (!Array.isArray(privileges) || privileges.length === 0) {
    throw new Error(
      "Stage 3.1 could not verify the active credential privileges. Use a dedicated " +
        "MongoDB user with the built-in read role on the target database(s).",
    );
  }

  // STAGE 3 STEP 3.1 REVISED: Require the built-in read role only. This deliberately
  // rejects app users, custom mixed roles, readWrite, dbOwner, and broad admin accounts.
  const unexpectedRoles = roles.filter((role) => role.role !== "read");
  const hasTargetReadRole = roles.some(
    (role) => role.role === "read" && role.db === db.getName(),
  );
  if (unexpectedRoles.length > 0 || !hasTargetReadRole) {
    const roleSummary = roles
      .map((role) => `${role.db}.${role.role}`)
      .sort()
      .join(", ");
    throw new Error(
      "Stage 3.1 requires a dedicated credential with only the built-in read role. " +
        `Observed roles: ${roleSummary || "none"}.`,
    );
  }

  const detectedWriteActions = new Set();
  for (const privilege of privileges) {
    for (const action of privilege.actions || []) {
      if (WRITE_CAPABLE_ACTIONS.has(action)) detectedWriteActions.add(action);
    }
  }

  if (detectedWriteActions.size > 0) {
    throw new Error(
      "Stage 3.1 refused to run because the active credential has write/admin " +
        `capabilities: ${Array.from(detectedWriteActions).sort().join(", ")}. ` +
        "Create/use a dedicated read-only MongoDB user and rerun the audit.",
    );
  }

  return {
    verified: true,
    authenticatedRoles: roles
      .map((role) => ({ role: role.role, db: role.db }))
      .sort((a, b) => `${a.db}.${a.role}`.localeCompare(`${b.db}.${b.role}`)),
    detectedWriteActions: [],
  };
}

// STAGE 3 STEP 3.1 REVISED: Sample only top-level field names, presence, and BSON
// types. Nested documents/arrays are flagged for targeted human review; values are not emitted.
function profileFields(coll, sampledDocuments) {
  if (sampledDocuments === 0) return [];

  const rows = coll.aggregate([
    { $limit: SAMPLE_LIMIT },
    { $project: { kv: { $objectToArray: "$$ROOT" } } },
    { $unwind: "$kv" },
    {
      $group: {
        _id: "$kv.k",
        observedTypes: { $addToSet: { $type: "$kv.v" } },
        present: { $sum: 1 },
        nonNull: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ["$kv.v", null] }, { $ne: [{ $type: "$kv.v" }, "missing"] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  return rows.map((row) => ({
    field: row._id,
    observedTypes: row.observedTypes.sort(),
    sampledPresence: row.present,
    sampledNonNull: row.nonNull,
    sampledPresenceRatio: Number((row.present / sampledDocuments).toFixed(4)),
    containsNestedStructure:
      row.observedTypes.includes("object") || row.observedTypes.includes("array"),
  }));
}

// STAGE 3 STEP 3.1 REVISED: Date coverage is computed only for actual BSON Date
// fields. String dates are never guessed/coerced during the metadata audit.
function profileDateRange(coll, field) {
  const rows = coll.aggregate([
    { $match: { [field]: { $type: "date" } } },
    {
      $group: {
        _id: null,
        min: { $min: `$${field}` },
        max: { $max: `$${field}` },
        recordsWithDate: { $sum: 1 },
      },
    },
    { $project: { _id: 0 } },
  ]).toArray();

  return rows[0] || null;
}

// STAGE 3 STEP 3.1 REVISED: Distinct counts never return the underlying values and
// are therefore used for geographic/identifier/grain discovery.
function distinctCount(coll, field) {
  const rows = coll.aggregate([
    { $match: { [field]: { $exists: true, $ne: null } } },
    { $group: { _id: `$${field}` } },
    { $count: "count" },
  ], { allowDiskUse: true }).toArray();

  return rows.length ? rows[0].count : 0;
}

// STAGE 3 STEP 3.1 REVISED: Enumerate a semantic vocabulary only when it is explicitly
// allowlisted, scalar, non-sensitive, and has <= MAX_ENUM_CARDINALITY distinct values.
function safeEnumProfile(coll, field, fieldProfile) {
  const count = distinctCount(coll, field);
  const scalarTypes = new Set(["string", "bool", "int", "long", "double", "decimal"]);
  const allScalar = (fieldProfile.observedTypes || []).every((type) => scalarTypes.has(type));

  if (looksSensitive(field) || looksLikeIdentifier(field) || GEOGRAPHIC_FIELDS.has(field)) {
    return {
      distinctCount: count,
      enumerated: false,
      valuesSuppressed: true,
      suppressionReason: "sensitive_identifier_or_geographic_field",
      values: null,
    };
  }

  if (!allScalar) {
    return {
      distinctCount: count,
      enumerated: false,
      valuesSuppressed: true,
      suppressionReason: "non_scalar_or_mixed_type",
      values: null,
    };
  }

  if (count > MAX_ENUM_CARDINALITY) {
    return {
      distinctCount: count,
      enumerated: false,
      valuesSuppressed: true,
      suppressionReason: `cardinality_above_${MAX_ENUM_CARDINALITY}`,
      values: null,
    };
  }

  const rows = coll.aggregate([
    { $match: { [field]: { $exists: true, $ne: null } } },
    { $group: { _id: `$${field}` } },
    { $sort: { _id: 1 } },
  ]).toArray();

  return {
    distinctCount: count,
    enumerated: true,
    valuesSuppressed: false,
    suppressionReason: null,
    values: rows.map((row) => row._id),
  };
}

// STAGE 3 STEP 3.1 REVISED: Candidate-grain duplicates are reported only as aggregate
// counts. No BMU/site/date/identifier combinations are emitted.
function duplicateProfile(coll, fields) {
  const groupId = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  const required = Object.fromEntries(
    fields.map((field) => [field, { $exists: true, $ne: null }]),
  );

  const rows = coll.aggregate([
    { $match: required },
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
  ], { allowDiskUse: true }).toArray();

  return rows[0] || {
    duplicateGroups: 0,
    duplicateDocuments: 0,
    maxDocumentsPerGroup: 1,
  };
}

// STAGE 3 STEP 3.1 REVISED: Identifier fields are summarized by coverage and
// uniqueness ratios only. No identifier values are ever included in the output.
function identifierProfile(coll, field, totalDocuments) {
  const distinct = distinctCount(coll, field);
  const nonNullRows = coll.countDocuments({ [field]: { $exists: true, $ne: null } });
  return {
    nonNullDocuments: nonNullRows,
    distinctValues: distinct,
    distinctToNonNullRatio:
      nonNullRows > 0 ? Number((distinct / nonNullRows).toFixed(4)) : null,
    coverageRatio:
      totalDocuments > 0 ? Number((nonNullRows / totalDocuments).toFixed(4)) : null,
  };
}

// STAGE 3 STEP 3.1 REVISED: Refuse databases outside the explicitly approved Stage 3
// targets. This is a second fail-closed boundary independent of the MongoDB role.
const databaseName = db.getName();
const targetCollections = TARGETS[databaseName];
if (!targetCollections) {
  throw new Error(
    `Database '${databaseName}' is not an approved Stage 3.1 audit target. ` +
      `Allowed databases: ${Object.keys(TARGETS).join(", ")}`,
  );
}

// STAGE 3 STEP 3.1 REVISED: Verify the active account before reading collection
// metadata. Use a dedicated read-only account; the audit will reject write capability.
const credentialSafety = assertReadOnlyCredential();

// STAGE 3 STEP 3.1 REVISED: Emit one sanitized collection-level audit document. The
// output is INTERNAL evidence for catalog review and must not be treated as public data.
const existingCollections = new Set(db.getCollectionNames());
const result = {
  auditVersion: AUDIT_VERSION,
  generatedAt: new Date().toISOString(),
  database: databaseName,
  sampleLimit: SAMPLE_LIMIT,
  maxEnumeratedSemanticCardinality: MAX_ENUM_CARDINALITY,
  handlingClassification: "internal_technical_audit",
  safety: {
    readOnlyCredentialVerified: credentialSafety.verified,
    authenticatedRoles: credentialSafety.authenticatedRoles,
    rawDocumentsExported: false,
    identifierValuesExported: false,
    geographicValuesExported: false,
    coordinatesExported: false,
    freeTextValuesExported: false,
    perSmallGroupStatisticsExported: false,
    semanticValuesAllowlist: Array.from(SAFE_ENUM_FIELDS).sort(),
    semanticValueEnumerationCardinalityGate: MAX_ENUM_CARDINALITY,
  },
  collections: [],
};

// STAGE 3 STEP 3.1 REVISED: Profile only approved collections and preserve missing
// collections as evidence because country deployments legitimately differ.
for (const name of targetCollections) {
  if (!existingCollections.has(name)) {
    result.collections.push({
      name,
      exists: false,
      sourceAccessStatus: "not_observed_in_database",
      computationStatus: "blocked",
    });
    continue;
  }

  // STAGE 3 STEP 3.1 REVISED: Collection-level counts and schema samples establish
  // structural evidence without exporting rows.
  const coll = db.getCollection(name);
  const estimatedDocuments = coll.estimatedDocumentCount();
  const sampledDocuments = Math.min(estimatedDocuments, SAMPLE_LIMIT);
  const fields = profileFields(coll, sampledDocuments);
  const fieldsByName = new Map(fields.map((field) => [field.field, field]));
  const fieldNames = new Set(fieldsByName.keys());

  // STAGE 3 STEP 3.1 REVISED: Preserve date evidence independently from any future
  // assumption that the date field is safe to aggregate across.
  const dateRanges = {};
  for (const field of fields) {
    if (field.observedTypes.includes("date")) {
      const range = profileDateRange(coll, field.field);
      if (range) dateRanges[field.field] = range;
    }
  }

  // STAGE 3 STEP 3.1 REVISED: Semantic values are cardinality-gated and never share
  // the same code path as identifiers/geographic dimensions.
  const semanticValues = {};
  for (const field of SAFE_ENUM_FIELDS) {
    if (fieldNames.has(field)) {
      semanticValues[field] = safeEnumProfile(coll, field, fieldsByName.get(field));
    }
  }

  // STAGE 3 STEP 3.1 REVISED: Dimension cardinalities expose only counts, which can
  // support grain analysis without revealing BMU/site/fisher/vessel values.
  const dimensionCardinalities = {};
  for (const field of CARDINALITY_FIELDS) {
    if (fieldNames.has(field)) dimensionCardinalities[field] = distinctCount(coll, field);
  }

  // STAGE 3 STEP 3.1 REVISED: Generic identifiers are profiled even when their names
  // do not match the sensitivity heuristic; this catches fields such as f_id.
  const identifierProfiles = {};
  for (const field of fieldNames) {
    if (looksLikeIdentifier(field)) {
      identifierProfiles[field] = identifierProfile(coll, field, estimatedDocuments);
    }
  }

  // STAGE 3 STEP 3.1 REVISED: Candidate grain checks validate repository hypotheses
  // structurally but do not by themselves authorize joins or rollups.
  const candidateGrains = [];
  for (const grain of REPO_CANDIDATE_GRAINS[name] || []) {
    if (grain.every((field) => fieldNames.has(field))) {
      candidateGrains.push({
        fields: grain,
        evidence: "repository_schema_plus_live_duplicate_check",
        duplicateCheck: duplicateProfile(coll, grain),
      });
    }
  }

  // STAGE 3 STEP 3.1 REVISED: Human review flags combine sensitive-name heuristics,
  // generic identifiers, free text, and nested structures. They never auto-clear a source.
  const potentialIdentifierFields = Array.from(fieldNames).filter(looksLikeIdentifier).sort();
  const potentialSensitiveFields = Array.from(fieldNames)
    .filter((field) => looksSensitive(field) || looksLikeIdentifier(field))
    .sort();
  const potentialFreeTextFields = Array.from(fieldNames).filter(looksLikeFreeText).sort();
  const nestedFieldsNeedTargetedAudit = fields
    .filter((field) => field.containsNestedStructure)
    .map((field) => field.field);

  // STAGE 3 STEP 3.1 REVISED: The audit never promotes a collection. Source access
  // and computation/rollup permission are explicitly separate unresolved decisions.
  result.collections.push({
    name,
    exists: true,
    sourceAccessStatus: "blocked_pending_human_review",
    computationStatus: "blocked_pending_derivation_review",
    estimatedDocuments,
    sampledDocumentsForSchema: sampledDocuments,
    fields,
    dateRanges,
    semanticValues,
    dimensionCardinalities,
    identifierProfiles,
    candidateGrains,
    geographicFrameEvidence: {
      observedGeographicFields: Array.from(fieldNames)
        .filter((field) => GEOGRAPHIC_FIELDS.has(field))
        .sort(),
      namespace: "unverified",
      parentMapping: "unverified",
    },
    governanceReview: {
      required: true,
      potentialSensitiveFields,
      potentialIdentifierFields,
      potentialFreeTextFields,
      nestedFieldsNeedTargetedAudit,
    },
    rollupReview: {
      required: true,
      defaultPolicy: "blocked_until_derivation_and_weighting_verified",
      note:
        "Field discovery proves presence/grain evidence only; it does not establish " +
        "weighted means, stock/flow semantics, units, or legal cross-dimension rollups.",
    },
  });
}

// STAGE 3 STEP 3.1 REVISED: Emit exactly one Extended JSON document. Use mongosh
// --quiet and redirect it to an INTERNAL file that is not committed to the repository.
print(EJSON.stringify(result, null, 2));
