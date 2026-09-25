import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import getDb from "@repo/nosql";

/**
 * Every procedure reads the portal summaries, so the connection is opened
 * (once per process) before any of them runs.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async () => {
  await getDb();
  return {};
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  // The tRPC route logs unexpected errors; the browser only learns that the
  // request failed, never a database driver's message.
  errorFormatter: ({ shape, error }) =>
    error.code === "INTERNAL_SERVER_ERROR" ? { ...shape, message: "Internal server error" } : shape,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
