import { StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

import "@workspace/ui/globals.css"
import "@/i18n"
import { Toaster } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { ThemeProvider } from "@/components/theme-provider"
import { router } from "@/router"
import { TRPCReactProvider } from "@/trpc/react"

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
        <Toaster />
      </ThemeProvider>
    </TRPCReactProvider>
  </StrictMode>
)
