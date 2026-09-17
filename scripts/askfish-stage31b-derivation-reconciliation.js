// STAGE 3 STEP 3.1B: Read-only derivation/reconciliation audit for the deeper Peskas sources.
// The script is intentionally evidence-only: it never writes, never promotes a source, and never emits
// geographic labels, identifiers, coordinates, raw records, or other record-level values.

// STAGE 3 STEP 3.1B: Version the output contract so Stage 3.2 can reject stale evidence.
const RECONCILIATION_VERSION = "1.0";

// STAGE 3 STEP 3.1B: Numeric comparisons use conservative tolerances because stored production values
// may have been rounded upstream. Tolerance is reported; a match never automatically activates a measure.
const ABS_TOLERANCE = 1e-6;
const REL_TOLERANCE = 1e-4;

// STAGE 3 STEP 3.1B: Only the production databases already audited in Stage 3.1A are accepted entry points.
// Kenya is audited from `app`; Mozambique may be entered from either `pipeline` or `mozambique-prod`.
const ALLOWED_ENTRY_DATABASES = new Set(["app", "pipeline", "mozambique-prod", "zanzibar-prod"]);

// STAGE 3 STEP 3.1B: Known write/admin actions are rejected even though this script contains no writes.
// Read-only therefore remains a property of both the active credential and the audit implementation.
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

// STAGE 3 STEP 3.1B: Convert BSON numeric values to finite JavaScript numbers without coercing strings.
function finiteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toString === "function" && /Decimal128|Long|Int32/.test(value._bsontype || "")) {
    const converted = Number(value.toString());
    return Number.isFinite(converted) ? converted : null;
  }
  return null;
}

// STAGE 3 STEP 3.1B: Stable month keys are used only in memory for joining aggregate evidence and are
// never emitted, so no district/site/date combinations leave the audit process.
function monthKey(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

// STAGE 3 STEP 3.1B: Median is implemented locally so the audit does not depend on server-version-specific
// percentile accumulators. Only aggregate numeric candidate values are passed to this helper.
function median(values) {
  const clean = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[middle - 1] + clean[middle]) / 2 : clean[middle];
}

// STAGE 3 STEP 3.1B: Mean is kept separate from median because the purpose of Stage 3.1B is to test
// candidate derivations, not silently assume which summary statistic Peskas intended.
function mean(values) {
  const clean = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (clean.length === 0) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

// STAGE 3 STEP 3.1B: Sum is explicit and ignores missing/non-finite values rather than treating them as zero.
function sum(values) {
  const clean = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (clean.length === 0) return null;
  return clean.reduce((total, value) => total + value, 0);
}

// STAGE 3 STEP 3.1B: Numerical agreement uses both absolute and relative tolerance and never treats
// missing values as zero. The returned diagnostics contain no source keys or record values.
function comparisonError(observed, candidate) {
  if (!Number.isFinite(observed) || !Number.isFinite(candidate)) return null;
  const absError = Math.abs(candidate - observed);
  const scale = Math.max(Math.abs(observed), Math.abs(candidate), ABS_TOLERANCE);
  const relError = absError / scale;
  return {
    absError,
    relError,
    matches: absError <= ABS_TOLERANCE || relError <= REL_TOLERANCE,
  };
}

// STAGE 3 STEP 3.1B: Summarize many comparisons without emitting the geography/date keys that generated them.
function summarizeComparisons(errors) {
  const clean = errors.filter(Boolean);
  const absErrors = clean.map((item) => item.absError);
  const relErrors = clean.map((item) => item.relError);
  return {
    comparedGroups: clean.length,
    matchingGroups: clean.filter((item) => item.matches).length,
    matchRatio: clean.length ? Number((clean.filter((item) => item.matches).length / clean.length).toFixed(4)) : null,
    medianAbsoluteError: median(absErrors),
    medianRelativeError: median(relErrors),
    maxAbsoluteError: absErrors.length ? Math.max(...absErrors) : null,
    maxRelativeError: relErrors.length ? Math.max(...relErrors) : null,
    absoluteTolerance: ABS_TOLERANCE,
    relativeTolerance: REL_TOLERANCE,
  };
}

// STAGE 3 STEP 3.1B: Candidate-grain duplicates are reported as counts only; grouped dimension/identifier
// values are never emitted. This is the same privacy principle used by Stage 3.1A.
function duplicateProfile(coll, fields, extraMatch = {}) {
  const required = Object.fromEntries(fields.map((field) => [field, { $exists: true, $ne: null }]));
  const groupId = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  const rows = coll.aggregate([
    { $match: { ...extraMatch, ...required } },
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
  return rows[0] || { duplicateGroups: 0, duplicateDocuments: 0, maxDocumentsPerGroup: 1 };
}

// STAGE 3 STEP 3.1B: Require only built-in `read` roles and reject credentials with any known write/admin
// capability. The caller also declares which sibling databases are required for the chosen country audit.
function assertReadOnlyCredential(requiredDatabases) {
  const status = db.getSiblingDB("admin").runCommand({ connectionStatus: 1, showPrivileges: true });
  if (!status || !status.authInfo) throw new Error("Unable to inspect MongoDB privileges for Stage 3.1B.");

  const roles = status.authInfo.authenticatedUserRoles || [];
  const privileges = status.authInfo.authenticatedUserPrivileges || [];
  if (!Array.isArray(roles) || roles.length === 0 || !Array.isArray(privileges) || privileges.length === 0) {
    throw new Error("Stage 3.1B requires a dedicated credential whose read-only privileges can be inspected.");
  }

  const unexpectedRoles = roles.filter((role) => role.role !== "read");
  if (unexpectedRoles.length > 0) {
    throw new Error(
      "Stage 3.1B requires only built-in read roles. Observed non-read roles: " +
        unexpectedRoles.map((role) => `${role.db}.${role.role}`).sort().join(", "),
    );
  }

  const roleDatabases = new Set(roles.filter((role) => role.role === "read").map((role) => role.db));
  const missingReadRoles = requiredDatabases.filter((database) => !roleDatabases.has(database));
  if (missingReadRoles.length > 0) {
    throw new Error(
      "Stage 3.1B requires built-in read on: " + requiredDatabases.join(", ") +
        ". Missing: " + missingReadRoles.join(", "),
    );
  }

  const writeActions = new Set();
  for (const privilege of privileges) {
    for (const action of privilege.actions || []) {
      if (WRITE_CAPABLE_ACTIONS.has(action)) writeActions.add(action);
    }
  }
  if (writeActions.size > 0) {
    throw new Error(
      "Stage 3.1B refused a write-capable credential. Detected actions: " +
        Array.from(writeActions).sort().join(", "),
    );
  }

  return {
    verified: true,
    readDatabases: Array.from(roleDatabases).filter((name) => requiredDatabases.includes(name)).sort(),
    detectedWriteActions: [],
  };
}

// STAGE 3 STEP 3.1B: Build a private key for aggregate reconciliation. The key may contain geography but
// remains process-local and is never placed in the emitted JSON.
function privateKey(parts) {
  return parts.map((part) => String(part ?? "")).join("\u241f");
}

// STAGE 3 STEP 3.1B: Kenya `catch_monthly` and `monthly_stats` overlap at BMU × month. Comparing the
// stored mean/rate fields tests whether `monthly_stats` is a production mirror/subset without exposing BMUs.
function auditKenya() {
  const appDb = db.getSiblingDB("app");
  const catchMonthly = appDb.getCollection("catch_monthly");
  const monthlyStats = appDb.getCollection("monthly_stats");
  const fishDistribution = appDb.getCollection("fish_distribution");
  const gearSummaries = appDb.getCollection("gear_summaries");

  const catchRows = catchMonthly.find(
    { BMU: { $type: "string" }, date: { $type: "date" } },
    { _id: 0, BMU: 1, date: 1, mean_effort: 1, mean_cpue: 1, mean_cpua: 1, mean_rpue: 1, mean_rpua: 1 },
  ).toArray();
  const statsRows = monthlyStats.find(
    { BMU: { $type: "string" }, date: { $type: "date" } },
    { _id: 0, BMU: 1, date: 1, mean_effort: 1, mean_cpue: 1, mean_cpua: 1, mean_rpue: 1, mean_rpua: 1 },
  ).toArray();

  const catchMap = new Map();
  for (const row of catchRows) catchMap.set(privateKey([row.BMU, row.date.toISOString()]), row);

  const metrics = ["mean_effort", "mean_cpue", "mean_cpua", "mean_rpue", "mean_rpua"];
  const metricErrors = Object.fromEntries(metrics.map((metric) => [metric, []]));
  let overlappingGrains = 0;
  for (const row of statsRows) {
    const source = catchMap.get(privateKey([row.BMU, row.date.toISOString()]));
    if (!source) continue;
    overlappingGrains += 1;
    for (const metric of metrics) {
      const observed = finiteNumber(row[metric]);
      const candidate = finiteNumber(source[metric]);
      if (observed === null || candidate === null) continue;
      metricErrors[metric].push(comparisonError(observed, candidate));
    }
  }

  const fishNumericRows = fishDistribution.countDocuments({
    landing_site: { $type: "string" },
    date: { $type: "date" },
    fish_category: { $type: "string" },
    total_catch_kg: { $type: "number" },
  });

  return {
    countryCode: "KE",
    sourceDatabases: ["app"],
    catchMonthly: {
      declaredCandidateGrain: ["BMU", "date"],
      duplicateCheck: duplicateProfile(catchMonthly, ["BMU", "date"]),
      analyticalRows: catchRows.length,
    },
    monthlyStatsMirrorCheck: {
      declaredCandidateGrain: ["BMU", "date"],
      duplicateCheck: duplicateProfile(monthlyStats, ["BMU", "date"]),
      analyticalRows: statsRows.length,
      overlappingGrains,
      fieldAgreement: Object.fromEntries(metrics.map((metric) => [metric, summarizeComparisons(metricErrors[metric])])),
      interpretation: "Evidence only: exact agreement would show monthly_stats mirrors catch_monthly at overlapping BMU-month grains; it does not reveal how the mean/rate fields were originally derived.",
    },
    fishDistribution: {
      declaredCandidateGrain: ["landing_site", "date", "fish_category"],
      duplicateCheck: duplicateProfile(fishDistribution, ["landing_site", "date", "fish_category"]),
      analyticalRowsWithNumericTotalCatchKg: fishNumericRows,
      repositoryReadSideEvidence: "packages/api/src/router/fish-distribution.ts sums total_catch_kg across category/time requests; Stage 3.2 must still decide access/auth and upstream derivation confidence.",
    },
    gearSummaries: {
      candidateGrainTested: ["BMU", "date", "gear"],
      duplicateCheck: duplicateProfile(gearSummaries, ["BMU", "date", "gear"]),
      note: "This targeted grain check was not established by Stage 3.1A; zero duplicates would support the candidate physical grain but not rate rollup legality.",
    },
    unresolved: [
      "Upstream formula/weights for mean_effort, mean_cpue, mean_cpua, mean_rpue, and mean_rpua are not present in the dashboard repository.",
      "BMU/landing-site to portal district mapping remains unverified, so no cross-frame reconciliation is attempted.",
      "fish_distribution is served by protectedProcedure and therefore remains blocked until AskFish can propagate Peskas identity/authorization.",
    ],
  };
}

// STAGE 3 STEP 3.1B: Group Mozambique validated detail rows to one submission internally. The output never
// includes submission IDs or geographic labels; only aggregate consistency/reconciliation statistics leave the process.
function buildMozambiqueSubmissionAggregates(validated) {
  return validated.aggregate([
    {
      $match: {
        submission_id: { $type: "string" },
        landing_date: { $type: "date" },
      },
    },
    {
      $group: {
        _id: "$submission_id",
        rowCount: { $sum: 1 },
        districts: { $addToSet: "$district" },
        landingSites: { $addToSet: "$landing_site" },
        landingDates: { $addToSet: "$landing_date" },
        gears: { $addToSet: "$gear" },
        totalCatchValues: { $addToSet: "$total_catch_kg" },
        fisherValues: { $addToSet: "$tot_fishers" },
        durationValues: { $addToSet: "$trip_duration" },
        district: { $first: "$district" },
        landingSite: { $first: "$landing_site" },
        landingDate: { $first: "$landing_date" },
        gear: { $first: "$gear" },
        totalCatchKg: { $first: "$total_catch_kg" },
        totalFishers: { $first: "$tot_fishers" },
        tripDuration: { $first: "$trip_duration" },
        sumCatchKg: {
          $sum: {
            $cond: [{ $eq: [{ $type: "$catch_kg" }, "double"] }, "$catch_kg", 0],
          },
        },
        sumCatchEstimate: {
          $sum: {
            $cond: [{ $eq: [{ $type: "$catch_estimate" }, "double"] }, "$catch_estimate", 0],
          },
        },
        // STAGE 3 STEP 3.1B: Preserve several price/revenue candidates because `catch_price` semantics are
        // not established by the field name. Missing/non-numeric price rows contribute nothing to each candidate.
        revenueCatchKgPrice: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: [{ $type: "$catch_kg" }, "double"] },
                  { $eq: [{ $type: "$catch_price" }, "double"] },
                ],
              },
              { $multiply: ["$catch_kg", "$catch_price"] },
              0,
            ],
          },
        },
        revenueEstimatePrice: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: [{ $type: "$catch_estimate" }, "double"] },
                  { $eq: [{ $type: "$catch_price" }, "double"] },
                ],
              },
              { $multiply: ["$catch_estimate", "$catch_price"] },
              0,
            ],
          },
        },
        sumCatchPrice: {
          $sum: {
            $cond: [{ $eq: [{ $type: "$catch_price" }, "double"] }, "$catch_price", 0],
          },
        },
        catchPriceCount: {
          $sum: {
            $cond: [{ $eq: [{ $type: "$catch_price" }, "double"] }, 1, 0],
          },
        },
      },
    },
  ], { allowDiskUse: true }).toArray();
}

// STAGE 3 STEP 3.1B: Convert a submission aggregate into candidate derivations. Candidate names are explicit
// so a later reviewer can see what was tested; matching a candidate is evidence, not proof of scientific intent.
function deriveMozambiqueSubmissionCandidates(row) {
  const totalCatchKg = finiteNumber(row.totalCatchKg);
  const sumCatchKg = finiteNumber(row.sumCatchKg);
  const sumCatchEstimate = finiteNumber(row.sumCatchEstimate);
  const totalFishers = finiteNumber(row.totalFishers);
  const tripDuration = finiteNumber(row.tripDuration);
  const revenueCatchKgPrice = finiteNumber(row.revenueCatchKgPrice);
  const revenueEstimatePrice = finiteNumber(row.revenueEstimatePrice);
  const sumCatchPrice = finiteNumber(row.sumCatchPrice);
  const catchPriceCount = finiteNumber(row.catchPriceCount);
  const effort = totalFishers !== null && tripDuration !== null && totalFishers > 0 && tripDuration > 0
    ? totalFishers * tripDuration
    : null;

  return {
    district: row.district,
    landingSite: row.landingSite,
    landingDate: row.landingDate,
    rowCount: row.rowCount,
    totalCatchKg,
    sumCatchKg,
    sumCatchEstimate,
    totalFishers,
    tripDuration,
    cpueFromTotalCatch: effort ? totalCatchKg / effort : null,
    cpueFromSummedCatchKg: effort ? sumCatchKg / effort : null,
    cpueFromSummedCatchEstimate: effort ? sumCatchEstimate / effort : null,
    rpueFromCatchKgTimesPrice: effort ? revenueCatchKgPrice / effort : null,
    rpueFromCatchEstimateTimesPrice: effort ? revenueEstimatePrice / effort : null,
    rpueFromSummedCatchPrice: effort && sumCatchPrice !== null ? sumCatchPrice / effort : null,
    weightedPriceFromCatchKg: sumCatchKg && sumCatchKg > 0 ? revenueCatchKgPrice / sumCatchKg : null,
    weightedPriceFromCatchEstimate: sumCatchEstimate && sumCatchEstimate > 0 ? revenueEstimatePrice / sumCatchEstimate : null,
    meanRowCatchPrice: catchPriceCount && catchPriceCount > 0 && sumCatchPrice !== null ? sumCatchPrice / catchPriceCount : null,
    summedCatchPrice: sumCatchPrice,
  };
}

// STAGE 3 STEP 3.1B: Compare native Mozambique monthly-metrics against several explicit candidate formulas
// derived from validated submission aggregates. Geographic/month keys are used only for joining in memory.
function reconcileMozambiqueMonthlyMetrics(submissions, nativeDb) {
  const collection = nativeDb.getCollection("monthly-metrics");
  const observedRows = collection.find(
    {
      district: { $type: "string" },
      date: { $type: "date" },
      metric: { $type: "string" },
      value: { $type: "number" },
    },
    { _id: 0, district: 1, date: 1, metric: 1, value: 1, n: 1 },
  ).toArray();

  const grouped = new Map();
  for (const submission of submissions) {
    if (!submission.district || !(submission.landingDate instanceof Date)) continue;
    const month = monthKey(submission.landingDate);
    if (!month) continue;
    const key = privateKey([submission.district, month]);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(submission);
  }

  const candidateErrors = {
    median_cpue: {
      median_cpue_from_total_catch: [],
      median_cpue_from_summed_catch_kg: [],
      median_cpue_from_summed_catch_estimate: [],
    },
    median_rpue: {
      median_rpue_from_catch_kg_times_price: [],
      median_rpue_from_catch_estimate_times_price: [],
      median_rpue_from_summed_catch_price: [],
    },
    median_price_kg: {
      median_weighted_price_from_catch_kg: [],
      median_weighted_price_from_catch_estimate: [],
      median_submission_mean_row_catch_price: [],
    },
    n_fishers: {
      sum_fishers: [],
      mean_fishers: [],
      median_fishers: [],
    },
    trip_duration: {
      mean_trip_duration: [],
      median_trip_duration: [],
    },
  };
  const sampleSizeErrors = [];

  for (const observed of observedRows) {
    const month = monthKey(observed.date);
    if (!month) continue;
    const group = grouped.get(privateKey([observed.district, month]));
    if (!group || group.length === 0) continue;
    const value = finiteNumber(observed.value);
    if (value === null) continue;

    if (observed.metric === "median_cpue") {
      candidateErrors.median_cpue.median_cpue_from_total_catch.push(
        comparisonError(value, median(group.map((row) => row.cpueFromTotalCatch))),
      );
      candidateErrors.median_cpue.median_cpue_from_summed_catch_kg.push(
        comparisonError(value, median(group.map((row) => row.cpueFromSummedCatchKg))),
      );
      candidateErrors.median_cpue.median_cpue_from_summed_catch_estimate.push(
        comparisonError(value, median(group.map((row) => row.cpueFromSummedCatchEstimate))),
      );
    } else if (observed.metric === "median_rpue") {
      candidateErrors.median_rpue.median_rpue_from_catch_kg_times_price.push(
        comparisonError(value, median(group.map((row) => row.rpueFromCatchKgTimesPrice))),
      );
      candidateErrors.median_rpue.median_rpue_from_catch_estimate_times_price.push(
        comparisonError(value, median(group.map((row) => row.rpueFromCatchEstimateTimesPrice))),
      );
      candidateErrors.median_rpue.median_rpue_from_summed_catch_price.push(
        comparisonError(value, median(group.map((row) => row.rpueFromSummedCatchPrice))),
      );
    } else if (observed.metric === "median_price_kg") {
      candidateErrors.median_price_kg.median_weighted_price_from_catch_kg.push(
        comparisonError(value, median(group.map((row) => row.weightedPriceFromCatchKg))),
      );
      candidateErrors.median_price_kg.median_weighted_price_from_catch_estimate.push(
        comparisonError(value, median(group.map((row) => row.weightedPriceFromCatchEstimate))),
      );
      candidateErrors.median_price_kg.median_submission_mean_row_catch_price.push(
        comparisonError(value, median(group.map((row) => row.meanRowCatchPrice))),
      );
    } else if (observed.metric === "n_fishers") {
      const fishers = group.map((row) => row.totalFishers);
      candidateErrors.n_fishers.sum_fishers.push(comparisonError(value, sum(fishers)));
      candidateErrors.n_fishers.mean_fishers.push(comparisonError(value, mean(fishers)));
      candidateErrors.n_fishers.median_fishers.push(comparisonError(value, median(fishers)));
    } else if (observed.metric === "trip_duration") {
      const durations = group.map((row) => row.tripDuration);
      candidateErrors.trip_duration.mean_trip_duration.push(comparisonError(value, mean(durations)));
      candidateErrors.trip_duration.median_trip_duration.push(comparisonError(value, median(durations)));
    }

    const observedN = finiteNumber(observed.n);
    if (observedN !== null) sampleSizeErrors.push(comparisonError(observedN, group.length));
  }

  const summarized = {};
  for (const [metric, candidates] of Object.entries(candidateErrors)) {
    summarized[metric] = Object.fromEntries(
      Object.entries(candidates).map(([candidate, errors]) => [candidate, summarizeComparisons(errors)]),
    );
  }

  return {
    candidateGrain: ["district", "date", "metric"],
    duplicateCheck: duplicateProfile(collection, ["district", "date", "metric"]),
    observedNumericRows: observedRows.length,
    candidateFormulaAgreement: summarized,
    reportedNAgainstSubmissionCount: summarizeComparisons(sampleSizeErrors),
    interpretation: "Evidence only. A high match ratio identifies a likely stored derivation candidate; source-code confirmation is still required before Stage 3.2 marks a rate/mean as verified.",
  };
}

// STAGE 3 STEP 3.1B: Reconcile Mozambique taxa-sites against validated catch detail. This can verify whether
// stored catch_kg behaves like an additive site × taxon total and whether catch_percent is a share of site catch.
function reconcileMozambiqueTaxaSites(validated, nativeDb) {
  const collection = nativeDb.getCollection("taxa-sites");
  const observedRows = collection.find(
    {
      landing_site: { $type: "string" },
      catch_taxon: { $type: "string" },
      catch_kg: { $type: "number" },
    },
    { _id: 0, landing_site: 1, catch_taxon: 1, catch_kg: 1, catch_percent: 1 },
  ).toArray();

  const candidateRows = validated.aggregate([
    {
      $match: {
        landing_site: { $type: "string" },
        catch_taxon: { $type: "string" },
      },
    },
    {
      $group: {
        _id: { landing_site: "$landing_site", catch_taxon: "$catch_taxon" },
        catchKg: { $sum: "$catch_kg" },
        catchEstimate: { $sum: "$catch_estimate" },
      },
    },
  ], { allowDiskUse: true }).toArray();

  const byKey = new Map();
  const siteTotals = new Map();
  for (const row of candidateRows) {
    const site = row._id.landing_site;
    const taxon = row._id.catch_taxon;
    const catchKg = finiteNumber(row.catchKg);
    const catchEstimate = finiteNumber(row.catchEstimate);
    if (catchKg === null && catchEstimate === null) continue;
    byKey.set(privateKey([site, taxon]), { catchKg, catchEstimate });
    if (catchKg !== null) siteTotals.set(site, (siteTotals.get(site) || 0) + catchKg);
  }

  const catchErrors = [];
  const estimateErrors = [];
  const percentAsPercentageErrors = [];
  const percentAsFractionErrors = [];
  let matchedGroups = 0;
  for (const observed of observedRows) {
    const candidates = byKey.get(privateKey([observed.landing_site, observed.catch_taxon]));
    if (!candidates) continue;
    matchedGroups += 1;
    const observedCatch = finiteNumber(observed.catch_kg);
    if (observedCatch !== null && candidates.catchKg !== null) catchErrors.push(comparisonError(observedCatch, candidates.catchKg));
    if (observedCatch !== null && candidates.catchEstimate !== null) estimateErrors.push(comparisonError(observedCatch, candidates.catchEstimate));

    const observedPercent = finiteNumber(observed.catch_percent);
    const siteTotal = siteTotals.get(observed.landing_site);
    if (observedPercent !== null && candidates.catchKg !== null && Number.isFinite(siteTotal) && siteTotal > 0) {
      const fraction = candidates.catchKg / siteTotal;
      percentAsFractionErrors.push(comparisonError(observedPercent, fraction));
      percentAsPercentageErrors.push(comparisonError(observedPercent, fraction * 100));
    }
  }

  return {
    candidateGrain: ["landing_site", "catch_taxon"],
    duplicateCheck: duplicateProfile(collection, ["landing_site", "catch_taxon"]),
    observedNumericRows: observedRows.length,
    matchedGroups,
    catchKgAsSumOfValidatedCatchKg: summarizeComparisons(catchErrors),
    catchKgAsSumOfValidatedCatchEstimate: summarizeComparisons(estimateErrors),
    catchPercentAsZeroToOneShare: summarizeComparisons(percentAsFractionErrors),
    catchPercentAsZeroToHundredPercentage: summarizeComparisons(percentAsPercentageErrors),
    interpretation: "Evidence only. Strong agreement supports additive catch_kg semantics for this native summary; it does not authorize cross-frame joins to portal districts.",
  };
}

// STAGE 3 STEP 3.1B: Reconcile Mozambique sites-stats against one-row-per-submission candidate statistics.
// Multiple plausible candidates are retained where the repository does not disclose the upstream formula.
function reconcileMozambiqueSitesStats(submissions, nativeDb) {
  const collection = nativeDb.getCollection("sites-stats");
  const observedRows = collection.find(
    { landing_site: { $type: "string" } },
    {
      _id: 0,
      landing_site: 1,
      cpue_kg_fisher_hr: 1,
      mean_catch_kg: 1,
      mean_catch_price_mzn: 1,
      n_fishers: 1,
      n_submissions: 1,
      price_per_kg_mzn: 1,
      trip_duration_hrs: 1,
    },
  ).toArray();

  const groups = new Map();
  for (const submission of submissions) {
    if (!submission.landingSite) continue;
    if (!groups.has(submission.landingSite)) groups.set(submission.landingSite, []);
    groups.get(submission.landingSite).push(submission);
  }

  const errors = {
    n_submissions: { submission_count: [] },
    n_fishers: { sum_fishers: [], mean_fishers: [], median_fishers: [] },
    trip_duration_hrs: { mean_trip_duration: [], median_trip_duration: [] },
    mean_catch_kg: { mean_total_catch: [], median_total_catch: [], mean_summed_catch_kg: [] },
    cpue_kg_fisher_hr: { mean_cpue_from_total_catch: [], median_cpue_from_total_catch: [] },
    price_per_kg_mzn: { mean_weighted_price_from_catch_kg: [], median_weighted_price_from_catch_kg: [], mean_submission_mean_row_price: [] },
    mean_catch_price_mzn: { mean_summed_catch_price: [], mean_catch_kg_times_price: [], mean_catch_estimate_times_price: [] },
  };
  let matchedSites = 0;

  for (const observed of observedRows) {
    const group = groups.get(observed.landing_site);
    if (!group || group.length === 0) continue;
    matchedSites += 1;

    const push = (bucket, observedValue, candidateValue) => {
      const left = finiteNumber(observedValue);
      if (left !== null && Number.isFinite(candidateValue)) bucket.push(comparisonError(left, candidateValue));
    };

    push(errors.n_submissions.submission_count, observed.n_submissions, group.length);
    const fishers = group.map((row) => row.totalFishers);
    push(errors.n_fishers.sum_fishers, observed.n_fishers, sum(fishers));
    push(errors.n_fishers.mean_fishers, observed.n_fishers, mean(fishers));
    push(errors.n_fishers.median_fishers, observed.n_fishers, median(fishers));

    const durations = group.map((row) => row.tripDuration);
    push(errors.trip_duration_hrs.mean_trip_duration, observed.trip_duration_hrs, mean(durations));
    push(errors.trip_duration_hrs.median_trip_duration, observed.trip_duration_hrs, median(durations));

    const totalCatches = group.map((row) => row.totalCatchKg);
    const summedCatches = group.map((row) => row.sumCatchKg);
    push(errors.mean_catch_kg.mean_total_catch, observed.mean_catch_kg, mean(totalCatches));
    push(errors.mean_catch_kg.median_total_catch, observed.mean_catch_kg, median(totalCatches));
    push(errors.mean_catch_kg.mean_summed_catch_kg, observed.mean_catch_kg, mean(summedCatches));

    const cpues = group.map((row) => row.cpueFromTotalCatch);
    push(errors.cpue_kg_fisher_hr.mean_cpue_from_total_catch, observed.cpue_kg_fisher_hr, mean(cpues));
    push(errors.cpue_kg_fisher_hr.median_cpue_from_total_catch, observed.cpue_kg_fisher_hr, median(cpues));

    const prices = group.map((row) => row.weightedPriceFromCatchKg);
    push(errors.price_per_kg_mzn.mean_weighted_price_from_catch_kg, observed.price_per_kg_mzn, mean(prices));
    push(errors.price_per_kg_mzn.median_weighted_price_from_catch_kg, observed.price_per_kg_mzn, median(prices));
    push(errors.price_per_kg_mzn.mean_submission_mean_row_price, observed.price_per_kg_mzn, mean(group.map((row) => row.meanRowCatchPrice)));

    push(errors.mean_catch_price_mzn.mean_summed_catch_price, observed.mean_catch_price_mzn, mean(group.map((row) => row.summedCatchPrice)));
    push(errors.mean_catch_price_mzn.mean_catch_kg_times_price, observed.mean_catch_price_mzn, mean(group.map((row) => row.weightedPriceFromCatchKg !== null && row.sumCatchKg !== null ? row.weightedPriceFromCatchKg * row.sumCatchKg : null)));
    push(errors.mean_catch_price_mzn.mean_catch_estimate_times_price, observed.mean_catch_price_mzn, mean(group.map((row) => row.weightedPriceFromCatchEstimate !== null && row.sumCatchEstimate !== null ? row.weightedPriceFromCatchEstimate * row.sumCatchEstimate : null)));
  }

  return {
    candidateGrain: ["landing_site"],
    duplicateCheck: duplicateProfile(collection, ["landing_site"]),
    observedRows: observedRows.length,
    matchedSites,
    candidateFormulaAgreement: Object.fromEntries(
      Object.entries(errors).map(([metric, candidates]) => [
        metric,
        Object.fromEntries(Object.entries(candidates).map(([candidate, values]) => [candidate, summarizeComparisons(values)])),
      ]),
    ),
    note: "Several explicit mean_catch_price_mzn candidates are tested, but none is treated as authoritative without source-code confirmation.",
  };
}

// STAGE 3 STEP 3.1B: Mozambique is the only audited country with a production validated-detail source plus
// native aggregate outputs. This makes it the highest-value derivation reconciliation target.
function auditMozambique() {
  const pipelineDb = db.getSiblingDB("pipeline");
  const nativeDb = db.getSiblingDB("mozambique-prod");
  const validated = pipelineDb.getCollection("validated");
  const rawSubmissionRows = buildMozambiqueSubmissionAggregates(validated);
  const submissions = rawSubmissionRows.map(deriveMozambiqueSubmissionCandidates);

  const consistencyFields = {
    district: "districts",
    landingSite: "landingSites",
    landingDate: "landingDates",
    gear: "gears",
    totalCatchKg: "totalCatchValues",
    totalFishers: "fisherValues",
    tripDuration: "durationValues",
  };
  const inconsistentSubmissions = {};
  for (const [label, field] of Object.entries(consistencyFields)) {
    inconsistentSubmissions[label] = rawSubmissionRows.filter((row) => Array.isArray(row[field]) && row[field].filter((value) => value !== null).length > 1).length;
  }

  const totalVsCatchErrors = [];
  const totalVsEstimateErrors = [];
  for (const submission of submissions) {
    if (submission.totalCatchKg !== null && submission.sumCatchKg !== null) {
      totalVsCatchErrors.push(comparisonError(submission.totalCatchKg, submission.sumCatchKg));
    }
    if (submission.totalCatchKg !== null && submission.sumCatchEstimate !== null) {
      totalVsEstimateErrors.push(comparisonError(submission.totalCatchKg, submission.sumCatchEstimate));
    }
  }

  return {
    countryCode: "MZ",
    sourceDatabases: ["pipeline", "mozambique-prod"],
    validatedStructure: {
      analyticalSubmissionGroups: submissions.length,
      candidateDetailGrains: {
        submissionTaxonLength: duplicateProfile(validated, ["submission_id", "catch_taxon", "length_class"]),
        submissionTaxonLengthOutcome: duplicateProfile(validated, ["submission_id", "catch_taxon", "length_class", "catch_outcome"]),
      },
      inconsistentSubmissionLevelFields: inconsistentSubmissions,
      totalCatchKgVsSumCatchKg: summarizeComparisons(totalVsCatchErrors),
      totalCatchKgVsSumCatchEstimate: summarizeComparisons(totalVsEstimateErrors),
      interpretation: "This tests whether repeated validated rows are catch/taxon/length components beneath a submission and which stored catch field reconstructs the submission total. It does not expose any submission key.",
    },
    monthlyMetrics: reconcileMozambiqueMonthlyMetrics(submissions, nativeDb),
    taxaSites: reconcileMozambiqueTaxaSites(validated, nativeDb),
    sitesStats: reconcileMozambiqueSitesStats(submissions, nativeDb),
    taxaLength: {
      candidateGrainTested: ["catch_taxon", "length_class"],
      duplicateCheck: duplicateProfile(nativeDb.getCollection("taxa-length"), ["catch_taxon", "length_class"]),
      note: "Repeated taxon × length_class rows would indicate an observation/distribution table rather than one aggregate value per taxon-length bin; no rollup is activated here.",
    },
    unresolved: [
      "Pipeline transformation source code was not present in the dashboard repository supplied for this review; numerical agreement is therefore corroborating evidence, not full derivation proof.",
      "Validated records retain submission_id and precise lat/lon fields, so direct AskFish access remains governance-blocked regardless of analytical usefulness.",
      "No district/landing-site to harmonized portal GAUL-2 mapping is assumed or tested.",
      "mean_catch_price_mzn semantics remain unresolved; several candidate formulas are tested, but none is authoritative without pipeline/source-code confirmation.",
    ],
  };
}

// STAGE 3 STEP 3.1B: Zanzibar's audited native production database contains only QC/operational collections.
// The script records that no analytical derivation reconciliation is possible instead of probing unrelated data.
function auditZanzibar() {
  return {
    countryCode: "TZ",
    sourceDatabases: ["zanzibar-prod"],
    analyticalReconciliation: "not_applicable_from_audited_native_sources",
    reason: "Stage 3.1A found only surveys_flags and enumerators_stats in zanzibar-prod; these remain governance-blocked operational/QC sources rather than normal analytical candidates.",
    unresolved: [
      "Derivation of harmonized Zanzibar portal summaries requires the upstream transformation source or a different approved production analytical source.",
    ],
  };
}

// STAGE 3 STEP 3.1B: Dispatch strictly by the database chosen in the mongosh URI; this prevents the script
// from becoming a generic cross-database explorer and makes required privileges explicit.
const entryDatabase = db.getName();
if (!ALLOWED_ENTRY_DATABASES.has(entryDatabase)) {
  throw new Error(
    `Stage 3.1B refuses database '${entryDatabase}'. Use app (Kenya), pipeline/mozambique-prod (Mozambique), or zanzibar-prod (Zanzibar).`,
  );
}

// STAGE 3 STEP 3.1B: Country-specific read roles are checked before any analytical query is executed.
let credentialEvidence;
let evidence;
if (entryDatabase === "app") {
  credentialEvidence = assertReadOnlyCredential(["app"]);
  evidence = auditKenya();
} else if (entryDatabase === "pipeline" || entryDatabase === "mozambique-prod") {
  credentialEvidence = assertReadOnlyCredential(["pipeline", "mozambique-prod"]);
  evidence = auditMozambique();
} else {
  credentialEvidence = assertReadOnlyCredential(["zanzibar-prod"]);
  evidence = auditZanzibar();
}

// STAGE 3 STEP 3.1B: Emit one sanitized JSON object suitable for controlled review/upload. No source data,
// dimension values, identifiers, or coordinates are included in this object.
print(EJSON.stringify({
  reconciliationVersion: RECONCILIATION_VERSION,
  generatedAt: new Date(),
  handlingClassification: "internal_technical_audit",
  rawDocumentsExported: false,
  geographicValuesExported: false,
  identifiersExported: false,
  automaticPromotion: false,
  credentialEvidence,
  evidence,
}, null, 2));
