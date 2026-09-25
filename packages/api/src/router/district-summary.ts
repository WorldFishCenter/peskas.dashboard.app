import { z } from "zod";
import { lastMonths } from "../lib/date-window";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { DistrictSummaryModel } from "@repo/nosql/schema/district-summary";
import { GAUL2_DISTRICT_NAMES, GAUL2_TO_REGION } from "@repo/nosql/constants/gaul2-districts";
import getDb from "@repo/nosql";
import { TRPCError } from "@trpc/server";

export const districtSummaryRouter = createTRPCRouter({
  getDistrictsSummary: publicProcedure
    .input(
      z.object({
        districts: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      // If no districts provided, return empty array
      if (!input.districts || input.districts.length === 0) {
        return [];
      }

      try {
        await getDb(); // Ensure DB connection is established
        
        // Fetch district summaries and aggregate by district
        const summaries = await DistrictSummaryModel.aggregate([
          {
            $match: {
              gaul_2_name: { $in: input.districts }
            }
          },
          {
            $group: {
              _id: "$gaul_2_name",
              indicators: {
                $push: {
                  indicator: "$indicator",
                  value: "$value"
                }
              }
            }
          },
          {
            $project: {
              _id: 0,
              gaul_2_name: "$_id",
              indicators: 1
            }
          }
        ]).exec();

        // Transform the data to have indicator properties
        return summaries.map(summary => {
          const result: any = {
            gaul_2_name: summary.gaul_2_name,
          };
          
          // Convert indicators array to properties
          summary.indicators.forEach((ind: { indicator: string; value: number }) => {
            result[ind.indicator] = ind.value;
          });
          
          return result;
        });
      } catch (error) {
        console.error("Error fetching district summaries:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch district summaries',
          cause: error,
        });
      }
    }),
  
  getAllDistrictsSummary: publicProcedure
    .query(async () => {
      try {
        await getDb(); // Ensure DB connection is established
        
        // Fetch all district summaries and aggregate by district
        const summaries = await DistrictSummaryModel.aggregate([
          {
            $group: {
              _id: "$gaul_2_name",
              indicators: {
                $push: {
                  indicator: "$indicator",
                  value: "$value"
                }
              }
            }
          },
          {
            $project: {
              _id: 0,
              gaul_2_name: "$_id",
              indicators: 1
            }
          }
        ]).exec();

        // Transform the data to have indicator properties
        return summaries.map(summary => {
          const result: any = {
            gaul_2_name: summary.gaul_2_name,
          };

          // Convert indicators array to properties
          summary.indicators.forEach((ind: { indicator: string; value: number }) => {
            result[ind.indicator] = ind.value;
          });

          return result;
        });
      } catch (error) {
        console.error("Error fetching all district summaries:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch all district summaries',
          cause: error,
        });
      }
    }),

  getMonthlyRegionSummary: publicProcedure
    .input(
      z.object({
        months: z.number().default(3),
      })
    )
    .query(async ({ input }) => {
      try {
        await getDb();
        

        // Fetch all relevant district summaries in the date range for the required metrics
        const metrics = [
          'n_submissions',
          'n_fishers',
          'trip_duration_hrs',
          'mean_cpue',
          'mean_rpue',
          'mean_price_kg',
          'estimated_revenue',
          'estimated_catch_tn'
        ];
        const summaries = await DistrictSummaryModel.find({
          indicator: { $in: metrics },
          // Last N months, from the first day of the earliest one.
          date: lastMonths(input.months, { fromMonthStart: true }),
        }).lean();

        // Group by metric, date, region using GAUL2_TO_REGION (region names are deployment-specific)
        const grouped: Record<string, Record<string, Record<string, number[]>>> = {};
        for (const s of summaries) {
          const region = GAUL2_TO_REGION[s.gaul_2_name];
          if (!region) continue;
          const metric = s.indicator;
          const dateStr = s.date ? s.date.toISOString().slice(0, 10) : undefined;
          if (!dateStr) continue;
          if (!grouped[metric]) grouped[metric] = {};
          if (!grouped[metric][dateStr]) grouped[metric][dateStr] = {};
          (grouped[metric][dateStr][region] ??= []).push(s.value);
        }

        // Prepare result — region keys are derived dynamically from GAUL2_TO_REGION values
        const result: Record<string, any> = {};
        for (const metric of metrics) {
          const dateEntries = grouped[metric] ? Object.entries(grouped[metric]) : [];
          // Sort by date ascending
          dateEntries.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
          // Only keep the last 3 months
          const last3 = dateEntries.slice(-3);
          result[metric] = {
            data: last3.map(([dateStr, regions]) => {
              const date = new Date(dateStr);
              const monthLabel = date.toLocaleString('default', { month: 'short', year: '2-digit' });
              const regionValues: Record<string, number | null> = {};
              for (const [regionName, vals] of Object.entries(regions)) {
                const valid = vals.filter((v): v is number => v !== null && v !== undefined && !isNaN(v as number));
                regionValues[regionName] = valid.length
                  ? valid.reduce((a, b) => a + b, 0) / valid.length
                  : null;
              }
              return { month: monthLabel, ...regionValues };
            }),
            months: last3.map(([dateStr]) => {
              const date = new Date(dateStr);
              return date.toLocaleString('default', { month: 'short', year: '2-digit' });
            })
          };
        }
        return result;
      } catch (error) {
        console.error("Error fetching monthly region summaries:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch monthly region summaries',
          cause: error,
        });
      }
    }),

  getDistrictsSummaryByDateRange: publicProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        await getDb();
        const start = new Date(input.startDate);
        const end = new Date(input.endDate);
        // Fetch all indicators for the date range
        const summaries = await DistrictSummaryModel.find({
          date: { $gte: start, $lte: end },
        }).lean();
        // Group by gaul_2_name and indicator
        const grouped: Record<string, Record<string, number[]>> = {};
        for (const s of summaries) {
          if (!grouped[s.gaul_2_name]) grouped[s.gaul_2_name] = {};
          if (!grouped[s.gaul_2_name][s.indicator]) grouped[s.gaul_2_name][s.indicator] = [];
          grouped[s.gaul_2_name][s.indicator].push(s.value);
        }
        const ALL_METRICS = [
          "mean_cpue", "mean_rpue", "n_fishers", "n_submissions", "trip_duration_hrs", "mean_price_kg", "estimated_revenue", "estimated_catch_tn"
        ];
        // Prepare result: array of { gaul_2_name, indicator1: avg, ... } for official GAUL2 districts
        const result = GAUL2_DISTRICT_NAMES.map((gaul_2_name) => {
          const indicatorsObj = grouped[gaul_2_name] || {};
          const row: any = { gaul_2_name };
          for (const indicator of ALL_METRICS) {
            // Filter out null/undefined/NaN values before aggregating
            const values = (indicatorsObj[indicator] || []).filter(v => v !== null && v !== undefined && !isNaN(v));
            if (["n_submissions", "estimated_catch_tn", "estimated_revenue"].includes(indicator)) {
              row[indicator] = values.length ? values.reduce((a, b) => a + b, 0) : null;
            } else {
              row[indicator] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
            }
          }
          return row;
        });
        return result;
      } catch (error) {
        console.error("Error fetching district summaries by date range:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch district summaries by date range',
          cause: error,
        });
      }
    }),
}); 