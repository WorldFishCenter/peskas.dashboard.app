import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TaxaSummaryDistrictModel } from "@repo/nosql/schema/taxa-summary-district";
import getDb from "@repo/nosql";
import { TRPCError } from "@trpc/server";

// STAGE 2 STEP 2.7: Match the production portal contract observed directly in
// Mozambique, Kenya, and Zanzibar. Historical schema-only metrics are no longer
// accepted because they are absent from all three live taxa_summaries collections.
const taxaMetricSchema = z.enum([
  "catch_kg",
  "mean_length",
  "price_kg",
]);

// STAGE 2 STEP 2.7: Convert the dashboard's shared rolling-month selector into the
// same bounded date predicate now used by AskFish. This closes the old behavior where
// Catch Composition accepted `months` but silently ignored it.
function rollingMonthFilter(months?: number) {
  if (!months) return undefined;
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(endDate.getMonth() - months);
  return { $gte: startDate, $lte: endDate };
}

export const taxaSummariesRouter = createTRPCRouter({
  getDistrictTaxaSummaries: publicProcedure
    .input(
      z.object({
        districts: z.array(z.string()).optional(),
        species: z.array(z.string()).optional(),
        metrics: z.array(taxaMetricSchema).optional(),
        months: z.number().int().min(1).max(72).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        await getDb();

        // STAGE 2 STEP 2.7: Require the production analytical-row fields explicitly
        // so the collection-level metadata document and incomplete non-grain rows do
        // not participate in dashboard calculations.
        const matchQuery: Record<string, unknown> = {
          date: { $exists: true, $ne: null },
          gaul_2_name: { $exists: true, $ne: null },
          catch_taxon: { $exists: true, $ne: null },
          metric: { $in: input.metrics?.length ? input.metrics : [...taxaMetricSchema.options] },
          value: { $type: "number" },
        };

        if (input.districts?.length) {
          matchQuery.gaul_2_name = { $in: input.districts };
        }
        if (input.species?.length) {
          matchQuery.catch_taxon = { $in: input.species };
        }
        const dateFilter = rollingMonthFilter(input.months);
        if (dateFilter) matchQuery.date = dateFilter;

        // STAGE 2 STEP 2.7: Reduce monthly source-grain rows only for the dashboard
        // presentation layer. catch_kg is additive over the selected months; the two
        // stored monthly means/rates use the dashboard-compatible descriptive average.
        // AskFish's semantic catalog remains stricter and blocks unverified weighted
        // rollups for mean_length/price_kg.
        const records = await TaxaSummaryDistrictModel.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                gaul_2_name: "$gaul_2_name",
                catch_taxon: "$catch_taxon",
                metric: "$metric",
              },
              summed_value: { $sum: "$value" },
              averaged_value: { $avg: "$value" },
              scientific_name: { $first: "$scientific_name" },
            },
          },
          {
            $project: {
              _id: 0,
              gaul_2_name: "$_id.gaul_2_name",
              catch_taxon: "$_id.catch_taxon",
              metric: "$_id.metric",
              scientific_name: 1,
              value: {
                $cond: [
                  { $eq: ["$_id.metric", "catch_kg"] },
                  "$summed_value",
                  "$averaged_value",
                ],
              },
            },
          },
          { $sort: { gaul_2_name: 1, catch_taxon: 1, metric: 1 } },
        ]).exec();

        // STAGE 2 STEP 2.7: Pivot the validated metric rows into the existing
        // dashboard response shape so chart components do not need a new API contract.
        const grouped = records.reduce((acc: Record<string, any>, record: any) => {
          const key = `${record.gaul_2_name}|${record.catch_taxon}`;
          if (!acc[key]) {
            acc[key] = {
              gaul_2_name: record.gaul_2_name,
              catch_taxon: record.catch_taxon,
              scientific_name: record.scientific_name,
            };
          }
          if (typeof record.value === "number") acc[key][record.metric] = record.value;
          return acc;
        }, {});

        return Object.values(grouped);
      } catch (error) {
        console.error("Error fetching taxa summaries:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch taxa summaries",
          cause: error,
        });
      }
    }),

  getSpeciesComposition: publicProcedure
    .input(
      z.object({
        districts: z.array(z.string()).optional(),
        metric: taxaMetricSchema.default("catch_kg"),
        months: z.number().int().min(1).max(72).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        await getDb();

        // STAGE 2 STEP 2.7: Apply the same production-verified monthly time filter
        // as the visible dashboard selector and exclude metadata/non-grain rows.
        const matchQuery: Record<string, unknown> = {
          date: { $exists: true, $ne: null },
          gaul_2_name: { $exists: true, $ne: null },
          catch_taxon: { $exists: true, $ne: null },
          metric: input.metric,
          value: { $type: "number", $gt: 0 },
        };
        if (input.districts?.length) {
          matchQuery.gaul_2_name = { $in: input.districts };
        }
        const dateFilter = rollingMonthFilter(input.months);
        if (dateFilter) matchQuery.date = dateFilter;

        // STAGE 2 STEP 2.7: Aggregate first by taxon+district across the selected
        // months, then by taxon nationally/over the selected districts. Additive
        // catch_kg is summed; mean_length/price_kg remain descriptive dashboard
        // averages rather than being incorrectly summed. AskFish itself remains more
        // conservative and blocks those mean/rate rollups pending derivation review.
        const composition = await TaxaSummaryDistrictModel.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                catch_taxon: "$catch_taxon",
                gaul_2_name: "$gaul_2_name",
              },
              district_sum: { $sum: "$value" },
              district_average: { $avg: "$value" },
              scientific_name: { $first: "$scientific_name" },
            },
          },
          {
            $project: {
              _id: 1,
              scientific_name: 1,
              district_value: {
                $cond: [
                  { $eq: [input.metric, "catch_kg"] },
                  "$district_sum",
                  "$district_average",
                ],
              },
            },
          },
          {
            $group: {
              _id: "$_id.catch_taxon",
              taxon_sum: { $sum: "$district_value" },
              taxon_average: { $avg: "$district_value" },
              scientific_name: { $first: "$scientific_name" },
              districts: {
                $push: {
                  gaul_2_name: "$_id.gaul_2_name",
                  value: "$district_value",
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              catch_taxon: "$_id",
              scientific_name: 1,
              total_value: {
                $cond: [
                  { $eq: [input.metric, "catch_kg"] },
                  "$taxon_sum",
                  "$taxon_average",
                ],
              },
              districts: 1,
            },
          },
          { $match: { total_value: { $gt: 0 } } },
          { $sort: { total_value: -1 } },
        ]).exec();

        return composition;
      } catch (error) {
        console.error("Error fetching species composition:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch species composition",
          cause: error,
        });
      }
    }),

  getDistrictSpeciesBreakdown: publicProcedure
    .input(
      z.object({
        district: z.string(),
        metric: taxaMetricSchema.default("catch_kg"),
      })
    )
    .query(async ({ input }) => {
      try {
        await getDb();

        // STAGE 2 STEP 2.7: This legacy lookup remains unbounded in time because no
        // current dashboard component calls it with a period. Keep it analytical-row
        // safe and aggregate additive catch across the available monthly rows.
        const breakdown = await TaxaSummaryDistrictModel.aggregate([
          {
            $match: {
              gaul_2_name: input.district,
              catch_taxon: { $exists: true, $ne: null },
              date: { $exists: true, $ne: null },
              metric: input.metric,
              value: { $type: "number" },
            },
          },
          {
            $group: {
              _id: "$catch_taxon",
              summed_value: { $sum: "$value" },
              averaged_value: { $avg: "$value" },
              scientific_name: { $first: "$scientific_name" },
            },
          },
          {
            $project: {
              _id: 0,
              catch_taxon: "$_id",
              scientific_name: 1,
              value: {
                $cond: [
                  { $eq: [input.metric, "catch_kg"] },
                  "$summed_value",
                  "$averaged_value",
                ],
              },
            },
          },
          { $sort: { value: -1 } },
        ]).exec();

        return breakdown;
      } catch (error) {
        console.error("Error fetching district species breakdown:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch district species breakdown",
          cause: error,
        });
      }
    }),

  getAllSpecies: publicProcedure.query(async () => {
    try {
      await getDb();

      // STAGE 2 STEP 2.7: Species discovery excludes the metadata document and
      // records without a real taxon label; no time aggregation is required here.
      const species = await TaxaSummaryDistrictModel.aggregate([
        {
          $match: {
            catch_taxon: { $exists: true, $ne: null },
            date: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$catch_taxon",
            scientific_name: { $first: "$scientific_name" },
          },
        },
        {
          $project: {
            _id: 0,
            catch_taxon: "$_id",
            scientific_name: 1,
          },
        },
        { $sort: { catch_taxon: 1 } },
      ]).exec();

      return species;
    } catch (error) {
      console.error("Error fetching all species:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch all species",
        cause: error,
      });
    }
  }),
});
