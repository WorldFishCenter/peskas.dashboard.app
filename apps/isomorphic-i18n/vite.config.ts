import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig, loadEnv, type HtmlTagDescriptor } from "vite"

import { COUNTRY_REGISTRY, type CountryConfig } from "./src/config/countries.ts"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const country = COUNTRY_REGISTRY[env.VITE_COUNTRY_CODE ?? "TZ"] ?? COUNTRY_REGISTRY.TZ

  return {
    plugins: [
      react(),
      tailwindcss(),
      nitro(),
      {
        name: "country-head",
        transformIndexHtml: () => countryHead(country, env).map((tag): HtmlTagDescriptor => ({ ...tag, injectTo: "head" })),
      },
    ],
    nitro: { serverDir: "./server" },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: { port: 3001 },
  }
})

/**
 * Static <head> tags for the deployment's country, so link previews and
 * Google Analytics work without running the app.
 *
 * VITE_GA_MEASUREMENT_ID points at this country's GA4 data stream; leaving it
 * unset (local dev, previews) adds no tracking. VITE_GA_ROLLUP_ID is optional
 * and shared by every deployment: gtag mirrors each event to it for a
 * platform-wide view. GA4 enhanced measurement tracks client-side navigations
 * through the History API, so no page_view is sent by hand. See ANALYTICS.md.
 */
function countryHead(country: CountryConfig, env: Record<string, string>): HtmlTagDescriptor[] {
  const og = (property: string, content: string): HtmlTagDescriptor => ({
    tag: "meta",
    attrs: { property: `og:${property}`, content },
  })
  const tags: HtmlTagDescriptor[] = [
    { tag: "title", children: country.siteTitle },
    { tag: "meta", attrs: { name: "description", content: country.siteDescription } },
    og("title", country.siteTitle),
    og("description", country.siteDescription),
    og("site_name", country.siteTitle),
    og("locale", country.locale.replace("-", "_")),
    og("type", "website"),
  ]

  const measurementId = env.VITE_GA_MEASUREMENT_ID
  if (!measurementId) return tags

  const destinations = [measurementId, env.VITE_GA_ROLLUP_ID].filter(Boolean)
  // Attached to every event so one property can be broken down by country;
  // gtag('set') must precede gtag('config') for the first page_view to carry it.
  const globalParams = {
    peskas_country: country.countryName,
    peskas_country_code: country.countryCode,
  }
  return [
    ...tags,
    {
      tag: "script",
      attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}` },
    },
    {
      tag: "script",
      children: [
        "window.dataLayer = window.dataLayer || [];",
        "function gtag(){dataLayer.push(arguments);}",
        "gtag('js', new Date());",
        `gtag('set', ${JSON.stringify(globalParams)});`,
        ...destinations.map((id) => `gtag('config', ${JSON.stringify(id)});`),
      ].join("\n"),
    },
  ]
}
