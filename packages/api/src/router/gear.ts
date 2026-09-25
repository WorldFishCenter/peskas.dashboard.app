import { z } from "zod";
import { lastMonths } from "../lib/date-window";

import { GearSummaryModel } from "@repo/nosql/schema/gear-summary";
import { GearSummaryDistrictModel } from "@repo/nosql/schema/gear-summary-district";
import { createTRPCRouter, publicProcedure } from "../trpc";
import getDb from "@repo/nosql";
import { TRPCError } from "@trpc/server";

export const gearRouter = createTRPCRouter({
  summaries: publicProcedure
    .input(z.object({ bmus: z.string().array() }))
    .query(({ input }) => {
      return GearSummaryModel
        .find({
          BMU: { $in: input.bmus }
        })
        .select({
          _id: 0,
          BMU: 1,
          gear: 1,
          mean_trip_catch: 1,
          mean_effort: 1,
          mean_cpue: 1,
          mean_cpua: 1,
          mean_rpue: 1,
          mean_rpua: 1
        })
        .exec();
    }),

  byGear: publicProcedure
    .input(z.object({
      districts: z.string().array(),
      indicator: z.enum(["cpue", "rpue"]),
      months: z.number().optional(),
    }))
    .query(async ({ input }) => {
      try {
        await getDb();

        const valueField = `avg_${input.indicator}`;
        const matchStage: any = {
          gaul_2_name: { $in: input.districts },
          indicator: input.indicator,
          value: { $ne: null, $exists: true },
        };

        if (input.months) {
          matchStage.date = lastMonths(input.months);
        }

        return await GearSummaryDistrictModel.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: "$gear",
              [valueField]: { $avg: "$value" },
              total_records: { $sum: 1 },
              districts: { $addToSet: "$gaul_2_name" },
            },
          },
          {
            $project: {
              _id: 0,
              gear: "$_id",
              [valueField]: { $round: [`$${valueField}`, 2] },
              total_records: 1,
              district_count: { $size: "$districts" },
            },
          },
          { $sort: { [valueField]: -1 } },
        ]).exec();
      } catch (error) {
        console.error('Error in gear by indicator query:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch ${input.indicator.toUpperCase()} by gear data`,
          cause: error,
        });
      }
    }),
});
