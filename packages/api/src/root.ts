import { gaul2BoundariesRouter, gridSummaryRouter, summariesRouter } from "./router";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  summaries: summariesRouter,
  gridSummary: gridSummaryRouter,
  gaul2Boundaries: gaul2BoundariesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
