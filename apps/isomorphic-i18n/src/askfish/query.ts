// STAGE 2 STEP 2.3: Implement the generic read-only Peskas query contract on top of
// the semantic catalog. The caller selects semantic dataset/measure/filter names only;
// physical MongoDB fields and collections are resolved exclusively from the catalog.
import { z } from "zod";

import getDb from "@repo/nosql";
import { activeCountry } from "@/config/countryConfig";
import { semanticCatalogForCountry } from "@/askfish/semantic-catalog";
// STAGE 2 STEP 2.7.1: Use the isolated newest-version selector so production
// duplicate handling is covered by a standalone deterministic regression test.
import { canonicalizeNewestByKey } from "@/askfish/canonicalization";
// STAGE 2 STEP 2.7.3: Resolve only aggregate semantic category labels (gear/taxon)
// against observed canonical values before Mongo filtering; arbitrary fuzzy matching is forbidden.
import {
  resolveExactSemanticCategoryValue,
  resolveSemanticCategoryValue,
} from "@/askfish/category-resolution";

// STAGE 2 STEP 2.3: Keep generic filter values scalar and bounded. Date filtering is
// handled separately so arbitrary MongoDB operators can never enter the query surface.
type QueryScalar = string | number;
type QueryTimeRange = {
  startDate?: string;
  endDate?: string;
  lastMonths?: number;
};

// STAGE 2 STEP 2.5: Preserve the exact absolute date window used by MongoDB so
// AskFish can distinguish missing observations from an ambiguous relative period.
type ResolvedQueryTimeWindow = {
  startDate: string | null;
  endDate: string | null;
  basis: "rolling_months" | "explicit_dates";
};
type AskFishQueryRequestShape = {
  contractVersion: "1.0";
  countryCode: string;
  dataset: string;
  measure: string;
  filters: Record<string, QueryScalar[]>;
  timeRange: QueryTimeRange | null;
  limit: number;
  scope: {
    mode: "restricted" | "unrestricted";
    pageId: string | null;
    dashboardFilters: {
      districts?: string[];
      metric?: string;
      months?: number | null;
    } | null;
  };
};

// STAGE 2 STEP 2.3: Use a narrow structural view of the already-validated semantic
// catalog so query execution stays type-safe without exposing the catalog's internals
// as a second independently maintained source of business semantics.
type CatalogDatasetView = {
  collection: string;
  grain: string[];
  layout: "long" | "wide";
  timeField: string | null;
  dimensions: Record<string, { field: string }>;
  measures: Record<string, {
    label: string;
    unit: { value: string };
    kind: "rate" | "count" | "total";
    derivationStatus: string;
  }>;
  binding: { database: string; collection: string };
  // STAGE 3 STEP 3.3: Optional source-frame provenance distinguishes Kenya BMUs
  // from the harmonized portal district/GAUL-2 namespace.
  geographicFrame?: {
    level: string;
    namespace: string;
    parentMappingStatus: string;
    note: string;
  };
  queryPolicy: {
    maxRows: number;
    timeFilterStatus: string;
    canonicalKey: string[];
  };
};
type DeploymentCatalogView = {
  catalogVersion: string;
  deployment: { countryCode: string; name: string; currencyCode: string };
  pageScopes: Record<string, { datasets: string[]; contextFilters: string[] }>;
  datasets: Record<string, CatalogDatasetView>;
};

const filterValueSchema = z.union([z.string().min(1).max(200), z.number().finite()]);

// STAGE 2 STEP 2.3: Support either an explicit ISO date window or the same bounded
// rolling-month convention used by the Peskas dashboard. The two modes are exclusive.
const timeRangeSchema = z
  .object({
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
    lastMonths: z.number().int().min(1).max(72).optional(),
  })
  .superRefine((value: QueryTimeRange, ctx: { addIssue: (issue: unknown) => void }) => {
    const hasExplicitRange = Boolean(value.startDate || value.endDate);
    if (hasExplicitRange && value.lastMonths !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use either an explicit date range or lastMonths, not both.",
      });
    }
    if (value.startDate && value.endDate && new Date(value.startDate) > new Date(value.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate must be before or equal to endDate.",
      });
    }
  });

// STAGE 2 STEP 2.3: Restricted mode receives only normalized dashboard context from
// AskFish. It is used as a hard upper bound; user-question filters may narrow the scope
// but can never broaden beyond the dashboard selection.
const scopeSchema = z.object({
  mode: z.enum(["restricted", "unrestricted"]),
  pageId: z.string().min(1).max(100).nullable(),
  dashboardFilters: z
    .object({
      districts: z.array(z.string().min(1).max(150)).max(100).optional(),
      metric: z.string().min(1).max(100).optional(),
      months: z.number().int().min(1).max(72).nullable().optional(),
    })
    .nullable(),
});

// STAGE 2 STEP 2.3: This is a source-record query, not an arbitrary analytical
// aggregation request. AskFish receives the relevant validated records at the catalog
// source grain and performs only catalog-approved analysis in later stages.
export const askFishQueryRequestSchema = z.object({
  contractVersion: z.literal("1.0"),
  countryCode: z.string().min(2).max(3),
  dataset: z.string().min(1).max(100),
  measure: z.string().min(1).max(100),
  filters: z.record(z.array(filterValueSchema).min(1).max(100)).default({}),
  timeRange: timeRangeSchema.nullable().default(null),
  limit: z.number().int().min(1).max(25000).default(5000),
  scope: scopeSchema,
});

export type AskFishQueryRequest = AskFishQueryRequestShape;

// STAGE 2 STEP 2.3: Attach an HTTP status to validation/runtime failures so the API
// route can distinguish bad plans, over-broad queries, and deployment misconfiguration.
export class AskFishQueryError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AskFishQueryError";
    this.statusCode = statusCode;
  }
}

// STAGE 2 STEP 2.3: Resolve nested MongoDB paths such as metadata.period without
// accepting caller-provided field names anywhere in the execution path.
function getPath(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
}

// STAGE 2 STEP 2.3: Serialize MongoDB date values consistently for the planner-facing
// response while preserving numbers and strings at their original semantic type.
function serializeValue(value: unknown): string | number | boolean | null {
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value === null || value === undefined) return null;
  return String(value);
}

// STAGE 2 STEP 2.6.1: Keep restricted measure semantics explicit for every page
// that now embeds AskFish. Catch/Revenue honor their single active metric selector;
// Catch Composition has no single metric selector, so all catalogued taxa measures
// remain within the page domain while dataset/grain/rollup rules still apply later.
function restrictedMeasureAllowed(
  pageId: string,
  datasetId: string,
  requestedMeasure: string,
  dashboardMetric?: string,
) {
  if (pageId === "catch") {
    if (datasetId === "monthly_district_summary") return requestedMeasure === dashboardMetric;
    if (datasetId === "gear_summary_district") return requestedMeasure === "cpue";
  }
  if (pageId === "revenue") {
    if (datasetId === "monthly_district_summary") return requestedMeasure === dashboardMetric;
    if (datasetId === "gear_summary_district") return requestedMeasure === "rpue";
  }

  // STAGE 2 STEP 2.6.1: Catch Composition is a multi-measure page backed by the
  // taxa summary dataset. The generic catalog validation immediately above already
  // rejects any measure that is not actually defined for this dataset.
  if (pageId === "catch_composition" && datasetId === "taxa_summary_district") {
    return true;
  }

  // STAGE 2 STEP 2.6.1: Any page not explicitly integrated remains fail-closed.
  return false;
}

// STAGE 2 STEP 2.3: Convert a dashboard rolling-period filter into the generic query
// contract. null means the dashboard is explicitly showing all available time.
function dashboardTimeRange(months: number | null | undefined) {
  if (months === undefined || months === null) return null;
  return { lastMonths: months };
}

// STAGE 2 STEP 2.3: Validate and normalize scope before any database field or
// collection is selected. Restricted mode injects the dashboard's hard constraints;
// unrestricted mode leaves the question-derived plan untouched.
function applyScope(
  request: AskFishQueryRequest,
  catalog: DeploymentCatalogView,
) {
  const dataset = catalog.datasets[request.dataset];
  if (!dataset) {
    throw new AskFishQueryError(`Dataset '${request.dataset}' is not queryable in this deployment.`);
  }
  if (!dataset.measures[request.measure]) {
    throw new AskFishQueryError(
      `Measure '${request.measure}' is not available in dataset '${request.dataset}'.`,
    );
  }
  if (request.limit > dataset.queryPolicy.maxRows) {
    throw new AskFishQueryError(
      `Requested limit ${request.limit} exceeds catalog maximum ${dataset.queryPolicy.maxRows}.`,
    );
  }

  const effectiveFilters = Object.fromEntries(
    Object.entries(request.filters).map(([key, values]) => [key, [...values]]),
  );
  let effectiveTimeRange = request.timeRange;

  if (request.scope.mode === "restricted") {
    const pageId = request.scope.pageId;
    const dashboardFilters = request.scope.dashboardFilters;
    if (!pageId || !dashboardFilters) {
      throw new AskFishQueryError("Restricted queries require pageId and dashboardFilters.");
    }

    const pageScope = catalog.pageScopes[pageId];
    if (!pageScope) {
      throw new AskFishQueryError(`Page '${pageId}' is not defined in the semantic catalog.`);
    }
    if (!pageScope.datasets.includes(request.dataset)) {
      throw new AskFishQueryError(
        `Dataset '${request.dataset}' is outside the restricted '${pageId}' page scope.`,
      );
    }
    if (!restrictedMeasureAllowed(pageId, request.dataset, request.measure, dashboardFilters.metric)) {
      throw new AskFishQueryError(
        `Measure '${request.measure}' is not part of the currently visible restricted '${pageId}' scope.`,
      );
    }

    if (dashboardFilters.districts?.length && dataset.dimensions.district) {
      const dashboardDistricts = new Set(dashboardFilters.districts);
      const requestedDistricts = effectiveFilters.district;
      if (requestedDistricts) {
        const outside = requestedDistricts.filter(
          (district) => typeof district !== "string" || !dashboardDistricts.has(district),
        );
        if (outside.length > 0) {
          throw new AskFishQueryError(
            "Restricted district filters may narrow the dashboard selection but cannot broaden it.",
          );
        }
      } else {
        effectiveFilters.district = [...dashboardFilters.districts];
      }
    }

    // STAGE 2 STEP 2.3: The current time-range filter is a hard restricted boundary.
    // A question cannot silently request a wider/different period while the switch is ON.
    if (dataset.timeField && pageScope.contextFilters.includes("time_range")) {
      effectiveTimeRange = dashboardTimeRange(dashboardFilters.months);
    }
  }

  return { dataset, effectiveFilters, effectiveTimeRange };
}

// STAGE 2 STEP 2.7.3: Only these aggregate semantic dimensions may use governed
// category resolution. Districts remain validated against the deployment config, and
// dates/measure discriminators continue through their dedicated contracts.
const RESOLVABLE_CATEGORY_DIMENSIONS = new Set(["gear", "taxon", "bmu"]);

// STAGE 2 STEP 2.7.3: Resolve user-entered category labels to canonical values that
// actually exist in the selected portal collection. The observed-value lookup stays
// server-side and is bounded to aggregate gear/taxon dimensions; no raw records, IDs,
// coordinates, or free text are returned to AskFish.
async function resolveSemanticCategoryFilters(
  mongoDb: NonNullable<Awaited<ReturnType<typeof getDb>>["connection"]["db"]>,
  dataset: CatalogDatasetView,
  measure: string,
  filters: Record<string, Array<string | number>>,
) {
  const resolvedFilters = Object.fromEntries(
    Object.entries(filters).map(([dimensionId, values]) => [dimensionId, [...values]]),
  );

  for (const [dimensionId, values] of Object.entries(resolvedFilters)) {
    if (!RESOLVABLE_CATEGORY_DIMENSIONS.has(dimensionId)) continue;
    const dimension = dataset.dimensions[dimensionId];
    if (!dimension) continue;

    const stringValues = values.filter((value): value is string => typeof value === "string");
    if (stringValues.length !== values.length) {
      throw new AskFishQueryError(
        `Semantic category filter '${dimensionId}' accepts string values only.`,
      );
    }

    const distinctFilter: Record<string, unknown> = {
      [dimension.field]: { $type: "string" },
    };
    if (dataset.layout === "long") {
      const discriminator = dataset.dimensions.metric ?? dataset.dimensions.indicator;
      if (!discriminator) {
        throw new AskFishQueryError(
          `Long-layout dataset '${dataset.collection}' has no metric/indicator discriminator.`,
          500,
        );
      }
      distinctFilter[discriminator.field] = measure;
    }

    const observedValues = (
      await mongoDb.collection(dataset.binding.collection).distinct(dimension.field, distinctFilter)
    ).filter((value): value is string => typeof value === "string");
    if (observedValues.length > 2000) {
      throw new AskFishQueryError(
        `Observed ${dimensionId} cardinality exceeds the safe category-resolution limit.`,
        413,
      );
    }

    const canonicalValues: string[] = [];
    for (const requested of stringValues) {
      // STAGE 3 STEP 3.3: BMU geography may normalize casing/punctuation only; never
      // use prefix matching that could silently select the wrong management unit.
      const resolution = dimensionId === "bmu"
        ? resolveExactSemanticCategoryValue(requested, observedValues)
        : resolveSemanticCategoryValue(requested, observedValues);
      if (resolution.method === "ambiguous") {
        // STAGE 3 STEP 3.3: Do not enumerate geographic BMU alternatives in errors.
        // Taxon/gear remain bounded low-cardinality semantic vocabularies.
        if (dimensionId === "bmu") {
          throw new AskFishQueryError(
            `BMU '${requested}' is ambiguous after safe canonical normalization. Use the exact Peskas BMU name.`,
            422,
          );
        }
        const candidates = resolution.candidates.slice(0, 5).join(", ");
        throw new AskFishQueryError(
          `Category '${requested}' is ambiguous for ${dimensionId}. Matching observed labels: ${candidates}.`,
          422,
        );
      }
      if (!resolution.resolved) {
        const message = dimensionId === "bmu"
          ? `No observed BMU safely matches '${requested}' in the Kenya native source. Use the exact Peskas BMU name.`
          : `No observed ${dimensionId} category safely matches '${requested}' in ${dataset.collection}.`;
        throw new AskFishQueryError(message, 422);
      }
      canonicalValues.push(resolution.resolved);
    }

    // STAGE 2 STEP 2.7.3: Preserve request order and fail closed when two requested
    // aliases collapse to the same observed category; comparison/filter semantics must
    // never silently lose a requested category after canonicalization.
    const uniqueCanonicalValues = Array.from(new Set(canonicalValues));
    if (uniqueCanonicalValues.length !== canonicalValues.length) {
      throw new AskFishQueryError(
        `Multiple requested ${dimensionId} labels resolve to the same observed category. Use unique category labels.`,
        422,
      );
    }
    resolvedFilters[dimensionId] = uniqueCanonicalValues;
  }

  return resolvedFilters;
}

// STAGE 2 STEP 2.5: Resolve a relative/explicit semantic time request exactly once.
// The same resolved bounds are used for MongoDB filtering and returned provenance.
function resolveTimeWindow(timeRange: QueryTimeRange | null): {
  mongoBounds: Record<string, Date> | null;
  provenance: ResolvedQueryTimeWindow | null;
} {
  if (!timeRange) return { mongoBounds: null, provenance: null };

  const mongoBounds: Record<string, Date> = {};
  let basis: ResolvedQueryTimeWindow["basis"] = "explicit_dates";

  if (timeRange.lastMonths !== undefined) {
    // STAGE 2 STEP 2.5: Match the existing rolling-window behavior exactly: the
    // end is request execution time and the start is N calendar months earlier.
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setMonth(endDate.getMonth() - timeRange.lastMonths);
    mongoBounds.$gte = startDate;
    mongoBounds.$lte = endDate;
    basis = "rolling_months";
  } else {
    if (timeRange.startDate) mongoBounds.$gte = new Date(timeRange.startDate);
    if (timeRange.endDate) mongoBounds.$lte = new Date(timeRange.endDate);
  }

  return {
    mongoBounds: Object.keys(mongoBounds).length > 0 ? mongoBounds : null,
    provenance: Object.keys(mongoBounds).length > 0
      ? {
          startDate: mongoBounds.$gte?.toISOString() ?? null,
          endDate: mongoBounds.$lte?.toISOString() ?? null,
          basis,
        }
      : null,
  };
}

// STAGE 2 STEP 2.3: Resolve a semantic dimension to its physical catalog field and
// reject filters on the measure discriminator itself; measure selection owns that field.
function buildMongoFilter(
  dataset: CatalogDatasetView,
  measure: string,
  filters: Record<string, Array<string | number>>,
  resolvedTimeWindow: { mongoBounds: Record<string, Date> | null },
) {
  const query: Record<string, unknown> = {};

  for (const [dimensionId, values] of Object.entries(filters)) {
    const dimension = dataset.dimensions[dimensionId];
    if (!dimension) {
      throw new AskFishQueryError(
        `Filter '${dimensionId}' is not a catalogued dimension of '${dataset.collection}'.`,
      );
    }
    if (dimensionId === "metric" || dimensionId === "indicator") {
      throw new AskFishQueryError(
        `Filter '${dimensionId}' is controlled by the requested measure and cannot be set separately.`,
      );
    }

    // STAGE 2 STEP 2.3: Date dimensions are filtered only through the bounded
    // timeRange contract so string values cannot accidentally bypass date semantics.
    if (dataset.timeField && dimension.field === dataset.timeField) {
      throw new AskFishQueryError(
        `Filter '${dimensionId}' must be expressed through timeRange.`,
      );
    }

    if (dimensionId === "district") {
      const validDistricts = new Set(activeCountry.districts);
      const invalidDistricts = values.filter(
        (value) => typeof value !== "string" || !validDistricts.has(value),
      );
      if (invalidDistricts.length > 0) {
        throw new AskFishQueryError("One or more district filters are invalid for this deployment.");
      }
    }

    query[dimension.field] = { $in: values };
  }

  // STAGE 2 STEP 2.3: Long-layout datasets use a catalogued metric/indicator
  // discriminator; wide datasets expose the requested measure as a physical field.
  if (dataset.layout === "long") {
    const discriminator = dataset.dimensions.metric ?? dataset.dimensions.indicator;
    if (!discriminator) {
      throw new AskFishQueryError(
        `Long-layout dataset '${dataset.collection}' has no metric/indicator discriminator.`,
        500,
      );
    }
    query[discriminator.field] = measure;
    query.value = { $type: "number" };
  } else {
    query[measure] = { $type: "number" };
  }

  // STAGE 2 STEP 2.7.1: Production verification shows that excluded records are not
  // limited to the single metadata/schema document: some source rows also have null
  // requested values or incomplete grain dimensions. Require a numeric measure plus
  // every canonical-key dimension so only complete analytical observations can enter
  // canonicalization, analysis, coverage, or provenance. Existing user filters are
  // strengthened in place rather than replaced.
  for (const canonicalPart of dataset.queryPolicy.canonicalKey) {
    if (canonicalPart === "metric" || canonicalPart === "indicator") continue;
    const dimension = dataset.dimensions[canonicalPart];
    if (!dimension) continue;

    const existing = query[dimension.field];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      query[dimension.field] = {
        ...(existing as Record<string, unknown>),
        $exists: true,
        $ne: null,
      };
    } else if (existing === undefined) {
      query[dimension.field] = { $exists: true, $ne: null };
    }
  }

  if (resolvedTimeWindow.mongoBounds) {
    if (!dataset.timeField || dataset.queryPolicy.timeFilterStatus !== "supported") {
      throw new AskFishQueryError(
        `Dataset '${dataset.collection}' does not support time filtering in the current catalog.`,
      );
    }

    // STAGE 2 STEP 2.5: Use the already-resolved absolute bounds rather than
    // recomputing relative dates, guaranteeing provenance matches the executed query.
    query[dataset.timeField] = resolvedTimeWindow.mongoBounds;
  }

  return query;
}

// STAGE 2 STEP 2.3: Build a projection from catalog fields only. Internal timestamp
// and ObjectId values are retained transiently for canonicalization/versioning and
// are never returned as raw MongoDB identifiers to AskFish.
function buildProjection(
  dataset: CatalogDatasetView,
  measure: string,
) {
  const projection: Record<string, 1> = { _id: 1, timestamp: 1 };
  for (const dimension of Object.values(dataset.dimensions)) projection[dimension.field] = 1;
  if (dataset.timeField) projection[dataset.timeField] = 1;
  if (dataset.layout === "long") projection.value = 1;
  else projection[measure] = 1;
  return projection;
}

// STAGE 2 STEP 2.7: Resolve each semantic canonical-key component from a physical
// record. The live portal contract now uses explicit dated grains for monthly, district,
// gear, and taxa summaries; the legacy snapshot fallback remains only for compatibility
// with older catalog versions during rolling deployment.
function canonicalComponent(
  record: Record<string, unknown>,
  dataset: CatalogDatasetView,
  key: string,
  measure: string,
) {
  if (key === "snapshot_or_date") {
    const dateValue = dataset.timeField ? getPath(record, dataset.timeField) : undefined;
    return dateValue instanceof Date ? dateValue.toISOString() : "__snapshot__";
  }
  if (key === "metric" || key === "indicator") return measure;
  const dimension = dataset.dimensions[key];
  if (!dimension) return `__unsupported_${key}`;
  const value = getPath(record, dimension.field);
  return value instanceof Date ? value.toISOString() : String(value ?? "__missing__");
}

// STAGE 2 STEP 2.7.1: Keep exactly one newest physical version per catalog grain.
// The production verifier observed up to four versions of some Mozambique monthly/
// district grains and two in Kenya, so canonicalization is mandatory rather than
// merely defensive. Version rows are selected, never numerically combined.
function canonicalizeRecords(
  records: Array<Record<string, unknown>>,
  dataset: CatalogDatasetView,
  measure: string,
) {
  return canonicalizeNewestByKey(records, (record) =>
    dataset.queryPolicy.canonicalKey
      .map((part) => canonicalComponent(record, dataset, part, measure))
      .join("::"),
  );
}

// STAGE 2 STEP 2.3: Convert canonical MongoDB records into a planner-safe semantic
// frame. The response exposes semantic dimension names and one numeric measure only.
function semanticRecords(
  records: Array<Record<string, unknown>>,
  dataset: CatalogDatasetView,
  measure: string,
) {
  const discriminatorIds = new Set(["metric", "indicator"]);
  return records
    .map((record) => {
      const dimensions = Object.fromEntries(
        Object.entries(dataset.dimensions)
          .filter(([dimensionId]) => !discriminatorIds.has(dimensionId))
          .map(([dimensionId, definition]) => [
            dimensionId,
            serializeValue(getPath(record, definition.field)),
          ])
          .filter(([, value]) => value !== null),
      );
      const rawValue = dataset.layout === "long" ? record.value : getPath(record, measure);
      return {
        dimensions,
        value: typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : null,
      };
    })
    .filter((record): record is { dimensions: Record<string, string | number | boolean>; value: number } =>
      record.value !== null,
    );
}

// STAGE 2 STEP 2.3: Execute one bounded catalog-approved source-record query. This
// function never accepts a MongoDB collection, field, operator, or aggregation pipeline
// from the caller; all such details are resolved from the validated semantic catalog.
export async function executeAskFishQuery(input: unknown) {
  const parsed = askFishQueryRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new AskFishQueryError(`Invalid AskFish query request: ${parsed.error.message}`);
  }
  const request = parsed.data as AskFishQueryRequest;

  if (request.countryCode !== activeCountry.countryCode) {
    throw new AskFishQueryError(
      `This deployment serves ${activeCountry.countryCode}, not ${request.countryCode}.`,
    );
  }

  const catalog = semanticCatalogForCountry(activeCountry.countryCode) as DeploymentCatalogView;
  const {
    dataset,
    effectiveFilters: scopedFilters,
    effectiveTimeRange,
  } = applyScope(request, catalog);

  const connection = await getDb();
  // STAGE 3 STEP 3.3: Resolve the database from the validated catalog binding, not
  // from whichever database happens to be the connection URI default. This is required
  // to serve portal-prod and Kenya app sources through the same governed endpoint.
  const mongoClient = connection.connection.getClient();
  const mongoDb = mongoClient.db(dataset.binding.database);

  // STAGE 2 STEP 2.7.3: Canonicalize safe aggregate category values before the final
  // Mongo predicate is built. This fixes natural-language variants such as `gillnet`
  // versus the production category `Gill Net` and fails closed on ambiguous taxa.
  const effectiveFilters = await resolveSemanticCategoryFilters(
    mongoDb,
    dataset,
    request.measure,
    scopedFilters,
  );

  // STAGE 2 STEP 2.5: Resolve relative dates before building MongoDB filters so the
  // response can expose the exact window used for coverage/provenance calculations.
  const resolvedTimeWindow = resolveTimeWindow(effectiveTimeRange);
  const mongoQuery = buildMongoFilter(
    dataset,
    request.measure,
    effectiveFilters,
    resolvedTimeWindow,
  );
  const projection = buildProjection(dataset, request.measure);

  // STAGE 2 STEP 2.3: Refuse broad result sets rather than silently truncating them.
  // This is the database-cost ceiling for the first generic query contract.
  const scanLimit = dataset.queryPolicy.maxRows;
  const rawRecords = await mongoDb
    .collection(dataset.binding.collection)
    .find(mongoQuery, { projection })
    .limit(scanLimit + 1)
    .toArray();
  if (rawRecords.length > scanLimit) {
    throw new AskFishQueryError(
      `Query matches more than ${scanLimit} source rows. Narrow the filters or time range.`,
      413,
    );
  }

  const canonicalRecords = canonicalizeRecords(
    rawRecords as Array<Record<string, unknown>>,
    dataset,
    request.measure,
  );
  const converted = semanticRecords(canonicalRecords, dataset, request.measure);
  const returnedRecords = converted.slice(0, request.limit);

  // STAGE 2 STEP 2.3: Data version is derived from the same canonical rows returned
  // by the governed query, using timestamp/date/ObjectId evidence in that order.
  const versionCandidates = canonicalRecords.map((record) => {
    if (record.timestamp instanceof Date) return record.timestamp.getTime();
    if (dataset.timeField) {
      const dateValue = getPath(record, dataset.timeField);
      if (dateValue instanceof Date) return dateValue.getTime();
    }
    const objectId = record._id as { getTimestamp?: () => Date } | undefined;
    return objectId?.getTimestamp?.().getTime() ?? 0;
  });
  const maxVersion = versionCandidates.length ? Math.max(...versionCandidates) : 0;

  return {
    contractVersion: "1.0" as const,
    catalogVersion: catalog.catalogVersion,
    dataset: request.dataset,
    measure: request.measure,
    measureMetadata: {
      label: dataset.measures[request.measure].label,
      unit: dataset.measures[request.measure].unit.value.replace(
        "{currency}",
        catalog.deployment.currencyCode,
      ),
      kind: dataset.measures[request.measure].kind,
      derivationStatus: dataset.measures[request.measure].derivationStatus,
    },
    scope: {
      mode: request.scope.mode,
      pageId: request.scope.pageId,
      effectiveFilters,
      effectiveTimeRange,
      // STAGE 2 STEP 2.5: Return the exact absolute query window alongside the
      // semantic request so AskFish can report calendar coverage reproducibly.
      resolvedTimeWindow: resolvedTimeWindow.provenance,
    },
    source: {
      system: "Peskas" as const,
      database: dataset.binding.database,
      collection: dataset.binding.collection,
      deployment: catalog.deployment.name,
      endpoint: "/api/askfish/query",
      grain: dataset.grain,
      // STAGE 3 STEP 3.3: Surface the source geographic namespace when present so
      // downstream provenance can explicitly state that BMU is not portal district.
      ...(dataset.geographicFrame ? { geographicFrame: dataset.geographicFrame } : {}),
    },
    dataVersion: maxVersion ? new Date(maxVersion).toISOString() : null,
    rawRecordCount: rawRecords.length,
    duplicateRecordCount: rawRecords.length - canonicalRecords.length,
    matchedCanonicalRecordCount: converted.length,
    recordCount: returnedRecords.length,
    truncated: converted.length > returnedRecords.length,
    records: returnedRecords,
  };
}
