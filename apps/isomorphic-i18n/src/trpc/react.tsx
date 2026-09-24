"use client";

import React, { Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink, httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import SuperJSON from "superjson";
import Cookies from "js-cookie";
import { useGlobalFilter } from "@/app/components/global-filter-provider";
import { AppRouter } from "@isomorphic/api";

export const api = createTRPCReact<AppRouter>();

// https://tanstack.com/query/latest/docs/framework/react/devtools
const ReactQueryDevtoolsProduction = React.lazy(() =>
  import("@tanstack/react-query-devtools/build/modern/production.js").then(
    (d) => ({
      default: d.ReactQueryDevtools,
    })
  )
);

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const { bmuFilter } = useGlobalFilter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnMount: false,
            refetchOnReconnect: false,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [showDevtools, setShowDevtools] = useState(
    process.env.NODE_ENV === "development" && false
  );
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchLink({
          // Above this, tRPC splits a batch; a single query over it is not
          // sent at all ("Input is too big for a single dispatch"). 2083 is
          // the conservative browser-safe limit; Vercel accepts far more.
          maxURLLength: 2083,
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          async headers() {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");
            headers.set("x-global-filters", Cookies.get("bmuFilter") ?? "[]");
            return headers;
          },
        }),
      ],
    })
  );

  useEffect(() => {
    // @ts-expect-error -- add toggleDevtools to window
    window.toggleDevtools = () => setShowDevtools((old) => !old);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
        {showDevtools && (
          <Suspense fallback={null}>
            <ReactQueryDevtoolsProduction buttonPosition="bottom-left" />
          </Suspense>
        )}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
