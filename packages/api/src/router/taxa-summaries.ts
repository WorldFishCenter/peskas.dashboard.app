import { z } from "zod";
import { lastMonths } from "../lib/date-window";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TaxaSummaryDistrictModel } from "@repo/nosql/schema/taxa-summary-district";
import getDb from "@repo/nosql";
import { TRPCError } from "@trpc/server";

const taxaMetricSchema = z.enum([
  "catch_kg",
  "mean_length", 
  "price_kg",
  "n_individuals",
  "total_value"
]);

// Totals are summed across months; per-fish or per-kg figures are averaged.
const SUMMED_TAXA_METRICS = new Set(["catch_kg", "n_individuals", "total_value"]);

/** Match clause limiting rows to the last `months` months (all rows when omitted). */
const monthWindow = (months?: number) => (months ? { date: lastMonths(months) } : {});

export const taxaSummariesRouter = createTRPCRouter({
  getDistrictTaxaSummaries: publicProcedure
    .input(
      z.object({
        districts: z.array(z.string()).optional(),
        species: z.array(z.string()).optional(),
        metrics: z.array(taxaMetricSchema).optional(),
        months: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        await getDb(); // Ensure DB connection is established
        
        // Build match query
        const matchQuery: any = {
          value: { $ne: null, $exists: true } // Only get records with actual values
        };
        
        if (input.districts && input.districts.length > 0) {
          matchQuery.gaul_2_name = { $in: input.districts };
        }
        if (input.species && input.species.length > 0) {
          matchQuery.catch_taxon = { $in: input.species };
        }
        if (input.metrics && input.metrics.length > 0) {
          matchQuery.metric = { $in: input.metrics };
        }
        
        Object.assign(matchQuery, monthWindow(input.months));

        // One value per district, species and metric across the window: rows are
        // monthly, so reading them one by one would keep only the last month.
        const rows: {
          _id: { gaul_2_name: string; catch_taxon: string; metric: string };
          scientific_name?: string;
          sum: number;
          avg: number;
        }[] = await TaxaSummaryDistrictModel.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: { gaul_2_name: "$gaul_2_name", catch_taxon: "$catch_taxon", metric: "$metric" },
              scientific_name: { $first: "$scientific_name" },
              sum: { $sum: "$value" },
              avg: { $avg: "$value" },
            },
          },
          { $sort: { "_id.gaul_2_name": 1, "_id.catch_taxon": 1 } },
        ]).exec();

        // Pivot to one row per district and species, with each metric as a property.
        const grouped: Record<string, Record<string, unknown>> = {};
        for (const row of rows) {
          const { gaul_2_name, catch_taxon, metric } = row._id;
          const key = `${gaul_2_name}|${catch_taxon}`;
          grouped[key] ??= { gaul_2_name, catch_taxon, scientific_name: row.scientific_name };
          grouped[key][metric] = SUMMED_TAXA_METRICS.has(metric) ? row.sum : row.avg;
        }

        return Object.values(grouped);
      } catch (error) {
        console.error("Error fetching taxa summaries:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch taxa summaries',
          cause: error,
        });
      }
    }),

  getSpeciesComposition: publicProcedure
    .input(
      z.object({
        districts: z.array(z.string()).optional(),
        metric: taxaMetricSchema.default("catch_kg"),
        months: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        await getDb();
        
        // Build match query - only get records with actual values for the specific metric
        const matchQuery: any = {
          metric: input.metric,
          value: { $ne: null, $exists: true, $gt: 0 } // Only positive values
        };
        
        if (input.districts && input.districts.length > 0) {
          matchQuery.gaul_2_name = { $in: input.districts };
        }

        Object.assign(matchQuery, monthWindow(input.months));

        // Aggregate species composition: combine each district's monthly values first
        // (summed or averaged by metric, as in getDistrictTaxaSummaries), then roll
        // districts up per species.
        const acrossMonths = SUMMED_TAXA_METRICS.has(input.metric) ? { $sum: "$value" } : { $avg: "$value" };
        const composition = await TaxaSummaryDistrictModel.aggregate([
          {
            $match: matchQuery
          },
          {
            $group: {
              _id: { catch_taxon: "$catch_taxon", gaul_2_name: "$gaul_2_name" },
              scientific_name: { $first: "$scientific_name" },
              value: acrossMonths,
            },
          },
          {
            $group: {
              _id: "$_id.catch_taxon",
              total_value: { $sum: "$value" },
              scientific_name: { $first: "$scientific_name" },
              districts: { $push: { gaul_2_name: "$_id.gaul_2_name", value: "$value" } },
            }
          },
          {
            $match: {
              total_value: { $gt: 0 } // Only include species with positive total values
            }
          },
          {
            $project: {
              _id: 0,
              catch_taxon: "$_id",
              scientific_name: 1,
              total_value: 1,
              districts: 1
            }
          },
          {
            $sort: { total_value: -1 }
          }
        ]).exec();

        return composition;
      } catch (error) {
        console.error("Error fetching species composition:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch species composition',
          cause: error,
        });
      }
    }),

  getDistrictSpeciesBreakdown: publicProcedure
    .input(
      z.object({
        district: z.string(), // gaul_2_name value
        metric: taxaMetricSchema.default("catch_kg"),
      })
    )
    .query(async ({ input }) => {
      try {
        await getDb();

        // Get all species for a specific district (gaul_2_name)
        const breakdown = await TaxaSummaryDistrictModel.aggregate([
          {
            $match: {
              gaul_2_name: input.district,
              metric: input.metric
            }
          },
          {
            $project: {
              _id: 0,
              catch_taxon: 1,
              scientific_name: 1,
              value: 1
            }
          },
          {
            $sort: { value: -1 }
          }
        ]).exec();

        return breakdown;
      } catch (error) {
        console.error("Error fetching district species breakdown:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch district species breakdown',
          cause: error,
        });
      }
    }),

  getAllSpecies: publicProcedure
    .query(async () => {
      try {
        await getDb();
        
        // Get unique species list
        const species = await TaxaSummaryDistrictModel.aggregate([
          {
            $group: {
              _id: "$catch_taxon",
              scientific_name: { $first: "$scientific_name" }
            }
          },
          {
            $project: {
              _id: 0,
              catch_taxon: "$_id",
              scientific_name: 1
            }
          },
          {
            $sort: { catch_taxon: 1 }
          }
        ]).exec();

        return species;
      } catch (error) {
        console.error("Error fetching all species:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch all species',
          cause: error,
        });
      }
    }),
});