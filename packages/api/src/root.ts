import { fishingEffortRouter, gaul2BoundariesRouter, summariesRouter } from "./router";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  summaries: summariesRouter,
  fishingEffort: fishingEffortRouter,
  gaul2Boundaries: gaul2BoundariesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
