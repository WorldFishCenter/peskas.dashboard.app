import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import "@workspace/ui/globals.css";
// The Peskas logo's colours, light and dark (synced from peskas-context/brand).
import "@/components/peskas-logo.css";
import "@/i18n";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { router } from "@/router";
import { TRPCReactProvider } from "@/trpc/react";

// PostHog (EU cloud): page views, clicks and session replays. Off where the key is
// unset, as in local dev and previews, which then never download it. See ANALYTICS.md.
const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
if (posthogKey) {
  void import("posthog-js").then(({ default: posthog }) =>
    posthog.init(posthogKey, { api_host: "https://eu.i.posthog.com", defaults: "2026-08-30" }),
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TRPCReactProvider>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          {/* react-i18next suspends while a language's strings load */}
          <Suspense>
            <RouterProvider router={router} />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </TRPCReactProvider>
  </StrictMode>,
);
