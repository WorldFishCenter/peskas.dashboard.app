import { createTRPCRouter, publicProcedure } from "../trpc";
import { GridSummaryModel } from "@repo/nosql/schema/grid-summary";

export const gridSummaryRouter = createTRPCRouter({
  all: publicProcedure.query(async () => {
    // Fetch all grid summaries (optionally add filters later)
    return await GridSummaryModel.find({}).lean();
  }),
});
