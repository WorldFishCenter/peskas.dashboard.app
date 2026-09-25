import { createTRPCRouter, publicProcedure } from "../trpc";
import { lastMonths } from "../lib/date-window";
import { MonthlySummaryDistrictModel } from "@repo/nosql/schema/monthly-summary-district";
import { z } from "zod";

export const monthlySummaryRouter = createTRPCRouter({
  districts: publicProcedure.query(async () => {
    const districts = await MonthlySummaryDistrictModel.distinct("gaul_2_name");
    // Filter out null/undefined values and ensure they are strings
    const validDistricts = districts.filter((d): d is string =>
      d !== null && d !== undefined && typeof d === "string"
    );
    return validDistricts.sort((a, b) => a.localeCompare(b));
  }),

  timeSeries: publicProcedure
    .input(z.object({
      districts: z.array(z.string().nullable()).transform(arr => arr.filter((d): d is string => d !== null)),
      metrics: z.array(z.string()),
      months: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const { districts, metrics, months } = input;

      const query: Record<string, unknown> = {
        gaul_2_name: { $in: districts },
        metric: { $in: metrics },
      };

      if (months) {
        query.date = lastMonths(months);
      }

      const data = await MonthlySummaryDistrictModel.find(query).sort({ date: 1 }).lean();

      // Group by date and metric (keys are gaul_2_name)
      const grouped: Record<string, Record<string, Record<string, number>>> = data.reduce((acc, item) => {
        const dateKey = item.date.toISOString().split('T')[0];
        if (!acc[dateKey]) acc[dateKey] = {};
        if (!acc[dateKey][item.metric]) acc[dateKey][item.metric] = {};
        acc[dateKey][item.metric][item.gaul_2_name] = item.value;
        return acc;
      }, {} as Record<string, Record<string, Record<string, number>>>);

      return grouped;
    }),

  radarData: publicProcedure
    .input(z.object({
      districts: z.array(z.string().nullable()).transform(arr => arr.filter((d): d is string => d !== null)),
      metrics: z.array(z.string()),
      months: z.number().min(1).max(72).default(12)
    }))
    .query(async ({ input }) => {
      const { districts, metrics, months } = input;

      const window = lastMonths(months);
      const endDate = window.$lte;

      const data = await MonthlySummaryDistrictModel.find({
        gaul_2_name: { $in: districts },
        metric: { $in: metrics },
        date: window,
      }).sort({ date: 1 }).lean();

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      // Collect the unique calendar months present in the selected range (in calendar order)
      const monthsInRange = new Set<number>();
      const d = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      for (let i = 0; i < months; i++) {
        monthsInRange.add(d.getMonth());
        d.setMonth(d.getMonth() - 1);
      }
      const sortedMonthIndices = Array.from(monthsInRange).sort((a, b) => a - b);

      // Group values by calendar month, accumulating across all years.
      //
      // Months with no measurement are skipped rather than counted as zero.
      // Coercing a missing value to 0 pulls the cross-year average down as if
      // the month had been surveyed and found empty, which is a different claim
      // from "not surveyed" -- districts with partial coverage were reading far
      // lower than their actual catch.
      const byMonth: Record<number, Record<string, number[]>> = {};
      for (const item of data) {
        if (item.metric !== metrics[0]) continue;
        if (item.value === null || item.value === undefined) continue;
        const m = item.date.getMonth();
        if (!byMonth[m]) byMonth[m] = {};
        (byMonth[m][item.gaul_2_name] ??= []).push(item.value);
      }

      // Return one point per calendar month with cross-year averages
      return sortedMonthIndices.map(monthIdx => {
        const districtValues: Record<string, number> = {};
        districts.forEach(name => {
          const vals = byMonth[monthIdx]?.[name];
          if (vals && vals.length > 0) {
            districtValues[name] = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
          }
        });
        return { month: monthNames[monthIdx], ...districtValues };
      });
    }),
}); 