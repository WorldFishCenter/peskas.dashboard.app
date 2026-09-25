import { appRouter, createTRPCContext } from "@isomorphic/api"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { defineHandler } from "nitro/h3"

// https://trpc.io/docs/server/adapters/fetch
export default defineHandler((event) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: event.req,
    router: appRouter,
    createContext: createTRPCContext,
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error)
    },
  })
)
