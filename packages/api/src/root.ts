import {
  authRouter,
  districtSummaryRouter,
  gaul2BoundariesRouter,
  gearRouter,
  gridSummaryRouter,
  monthlySummaryRouter,
  pingRouter,
  taxaSummariesRouter,
  userRouter,
} from "./router";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  ping: pingRouter,
  auth: authRouter,
  gear: gearRouter,
  user: userRouter,
  districtSummary: districtSummaryRouter,
  gridSummary: gridSummaryRouter,
  monthlySummary: monthlySummaryRouter,
  taxaSummaries: taxaSummariesRouter,
  gaul2Boundaries: gaul2BoundariesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
