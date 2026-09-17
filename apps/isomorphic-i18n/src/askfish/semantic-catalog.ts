// STAGE 2 STEP 2.2: Load the semantic catalog as data rather than embedding query
// semantics in the LLM prompt. The JSON document is the executable catalog source;
// the YAML file under docs/ is a human-readable mirror for review.
import { z } from "zod";

import catalogDocument from "./semantic-catalog.json";

// STAGE 2 STEP 2.2: Validate unit provenance explicitly so AskFish can distinguish
// confirmed dashboard units from inferred or still-unverified units.
const unitSchema = z.object({
  value: z.string().min(1),
  status: z.string().min(1),
});

// STAGE 2 STEP 2.2: Rollups are dimension-aware. A measure cannot be reduced just
// because it is numeric; every allowed/blocked reduction is declared in the catalog.
const rollupSchema = z.object({
  status: z.string().min(1),
  method: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});

// STAGE 2 STEP 2.2: Natural-language aliases are planner hints only. They resolve
// user concepts to known measures; they never grant additional query permissions.
const measureSchema = z.object({
  label: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
  kind: z.enum(["rate", "count", "total"]),
  unit: unitSchema,
  nativeGrain: z.array(z.string().min(1)).min(1),
  derivationStatus: z.string().min(1),
  rollups: z.record(rollupSchema),
});

// STAGE 2 STEP 2.2: Dimensions expose only named, catalogued fields. Optional fields
// remain queryable only when a later live-schema audit confirms their availability.
const dimensionSchema = z.object({
  field: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
  optional: z.boolean().optional(),
});

// STAGE 2 STEP 2.2: Country bindings separate the semantic dataset name from the
// physical MongoDB database/collection used by each deployment.
const bindingSchema = z.object({
  database: z.string().min(1),
  collection: z.string().min(1),
  status: z.literal("available"),
  observedDocuments: z.number().int().nonnegative(),
});

// STAGE 2 STEP 2.2: Keep application access and data classification separate; an
// unauthenticated tRPC route is evidence about app access, not final governance policy.
const accessSchema = z.object({
  applicationRoute: z.enum(["public", "protected"]),
  dataClassification: z.string().min(1),
  classificationStatus: z.string().min(1),
});

// STAGE 2 STEP 2.2: Query policy carries operational guardrails that the future
// generic query endpoint must enforce before any MongoDB query is constructed.
const queryPolicySchema = z.object({
  maxRows: z.number().int().positive().max(100000),
  timeFilterStatus: z.string().min(1),
  canonicalKey: z.array(z.string().min(1)).min(1),
  duplicateResolution: z.string().min(1),
});

// STAGE 2 STEP 2.2: A queryable dataset must define grain, dimensions, measures,
// country bindings, access, and rollup policy. This is the executable guardrail.
// STAGE 3 STEP 3.3: Native Kenya sources carry an explicit geographic namespace so
// AskFish can expose BMU provenance without pretending BMU is portal district/GAUL-2.
const geographicFrameSchema = z.object({
  level: z.string().min(1),
  namespace: z.string().min(1),
  parentMappingStatus: z.string().min(1),
  note: z.string().min(1),
});

const datasetSchema = z.object({
  queryable: z.literal(true),
  lineage: z.string().min(1),
  collection: z.string().min(1),
  grain: z.array(z.string().min(1)).min(1),
  layout: z.enum(["long", "wide"]),
  timeField: z.string().nullable(),
  geographyKey: z.string().nullable(),
  // STAGE 3 STEP 3.3: An empty pageScopes list means unrestricted-only. This is
  // intentional for Kenya BMU sources because no current dashboard page uses that frame.
  pageScopes: z.array(z.string().min(1)),
  geographicFrame: geographicFrameSchema.optional(),
  access: accessSchema,
  derivationStatus: z.string().min(1),
  dimensions: z.record(dimensionSchema),
  measures: z.record(measureSchema),
  bindings: z.record(bindingSchema),
  queryPolicy: queryPolicySchema,
  caveats: z.array(z.string().min(1)),
});

// STAGE 2 STEP 2.2: Discovery-only sources are deliberately visible to the planner
// metadata but remain non-queryable until field, grain, derivation, and governance
// audits are complete.
const discoveredSourceSchema = z.object({
  countryCode: z.string().min(2).max(3),
  tier: z.enum(["pipeline", "native_app"]),
  database: z.string().min(1),
  queryable: z.literal(false),
  status: z.string().min(1),
  collections: z.record(z.number().int().nonnegative()),
  reason: z.string().min(1),
});

// STAGE 2 STEP 2.2: Page scopes are the catalog-side definition needed by the
// future "Restrict to current page and filters" switch.
const pageScopeSchema = z.object({
  datasets: z.array(z.string().min(1)).min(1),
  contextFilters: z.array(z.string().min(1)),
  description: z.string().min(1),
});

// STAGE 2 STEP 2.2: Scope modes make the intended switch semantics machine-readable
// instead of relying on prompt wording.
const scopeModeSchema = z.object({
  pageDatasetsHard: z.boolean(),
  dashboardFiltersHard: z.boolean(),
  questionCanOverrideDashboardFilters: z.boolean(),
  pageContextIsHint: z.boolean(),
  description: z.string().min(1),
});

// STAGE 2 STEP 2.2: Validate the complete catalog once at module load. A malformed
// catalog fails closed before it can be served to AskFish.
const semanticCatalogSchema = z.object({
  catalogVersion: z.string().min(1),
  contractVersion: z.literal("1.0"),
  status: z.string().min(1),
  sourceEvidence: z.object({
    repository: z.string().min(1),
    liveMetadataAsOf: z.string().min(1),
    limitations: z.array(z.string().min(1)),
  }),
  scopeModes: z.object({
    restricted: scopeModeSchema,
    unrestricted: scopeModeSchema,
  }),
  countries: z.record(z.object({
    name: z.string().min(1),
    iso3: z.string().length(3),
    currencyCode: z.string().length(3),
  })),
  pageScopes: z.record(pageScopeSchema),
  datasets: z.record(datasetSchema),
  discoveredSources: z.array(discoveredSourceSchema),
});

// STAGE 2 STEP 2.2: Parse and freeze the catalog contract before exposing helper
// functions. The JSON remains easy to inspect/diff while Zod supplies runtime safety.
export const semanticCatalog = semanticCatalogSchema.parse(catalogDocument);

// STAGE 2 STEP 2.2: Validate cross-references that a shape schema alone cannot check:
// page scopes must reference real datasets and every dataset page tag must exist.
function validateCatalogReferences() {
  const datasetIds = new Set(Object.keys(semanticCatalog.datasets));
  const pageIds = new Set(Object.keys(semanticCatalog.pageScopes));

  for (const [pageId, page] of Object.entries(semanticCatalog.pageScopes)) {
    for (const datasetId of page.datasets) {
      if (!datasetIds.has(datasetId)) {
        throw new Error(`Semantic catalog page ${pageId} references unknown dataset ${datasetId}.`);
      }
    }
  }

  for (const [datasetId, dataset] of Object.entries(semanticCatalog.datasets)) {
    for (const pageId of dataset.pageScopes) {
      if (!pageIds.has(pageId)) {
        throw new Error(`Semantic catalog dataset ${datasetId} references unknown page ${pageId}.`);
      }
    }
  }
}
validateCatalogReferences();

// STAGE 2 STEP 2.2: Return a deployment-specific planner view. AskFish receives only
// the active country's physical binding while retaining semantic rules and blocked
// discovery sources needed to explain unsupported lower-grain questions.
export function semanticCatalogForCountry(countryCode: string) {
  const country = semanticCatalog.countries[countryCode];
  if (!country) throw new Error(`Semantic catalog does not define country ${countryCode}.`);

  const datasets = Object.fromEntries(
    Object.entries(semanticCatalog.datasets)
      .filter(([, dataset]) => dataset.bindings[countryCode]?.status === "available")
      .map(([datasetId, dataset]) => {
        const { bindings, ...semanticDataset } = dataset;
        return [
          datasetId,
          {
            ...semanticDataset,
            binding: bindings[countryCode],
          },
        ];
      }),
  );

  return {
    catalogVersion: semanticCatalog.catalogVersion,
    contractVersion: semanticCatalog.contractVersion,
    status: semanticCatalog.status,
    sourceEvidence: semanticCatalog.sourceEvidence,
    deployment: {
      countryCode,
      ...country,
    },
    scopeModes: semanticCatalog.scopeModes,
    pageScopes: semanticCatalog.pageScopes,
    datasets,
    discoveredSources: semanticCatalog.discoveredSources.filter(
      (source) => source.countryCode === countryCode,
    ),
  };
}
