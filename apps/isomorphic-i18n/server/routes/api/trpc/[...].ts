import { appRouter, createTRPCContext } from "@isomorphic/api"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { defineHandler } from "nitro/h3"

// Megabytes that change only when the pipeline runs: Vercel's CDN serves them
// for a day, then refreshes in the background, so most visits never reach Mongo.
const CDN_CACHED = new Set(["gaul2Boundaries.getByCountry", "gridSummary.all"])
const CDN_CACHE_CONTROL = `s-maxage=${60 * 60 * 24}, stale-while-revalidate=${60 * 60 * 24 * 7}`

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
    // https://trpc.io/docs/server/caching
    responseMeta({ paths, type, errors }) {
      const cacheable = type === "query" && errors.length === 0 && paths?.every((p) => CDN_CACHED.has(p))
      return cacheable ? { headers: { "cache-control": CDN_CACHE_CONTROL } } : {}
    },
  })
)
