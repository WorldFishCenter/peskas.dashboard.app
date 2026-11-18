import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { describeAskFishFailure } from "./askfish-errors";
import { askFishChartSchema } from "./askfish-chart-contract";
import { ASKFISH_MAX_MONTHS, ASKFISH_QUESTION } from "@repo/domain/askfish";
import { estimateMethod, isMetricKey, METRICS, type MetricKey } from "@repo/domain/metrics";
import { activeCountry, scopeDistricts } from "../lib/country";
import { createTRPCRouter, publicProcedure } from "../trpc";

/*
 * AskFish is a dashboard-wide chat. The browser sends districts, months and
 * locale only; the server supplies the fixed semantic context. Do not restore
 * the old page-specific scope (page/metric/restrict), which breaks both tRPC
 * endpoints against the current Peskas chat frontend.
 */

const ASKFISH_CONTEXT = {
  page: "catch_trends",
  metric: "mean_cpue",
  operation: "dashboard.semantic_context.v1",
} as const;

const filters = z.object({
  districts: z.array(z.string()),
  months: z.number().int().positive().max(ASKFISH_MAX_MONTHS).optional(),
  lang: z.string().refine((lang) => activeCountry().languages.includes(lang), "Unknown language"),
});
type Filters = z.infer<typeof filters>;

/** A country-wide semantic request; page filters are hints unless the question says to use them. */
function contextFor({ districts, months, lang }: Filters) {
  const country = activeCountry();
  const picked = scopeDistricts(districts.length ? districts : undefined);
  return {
    context: {
      type: "PESKAS_PAGE_CONTEXT",
      version: "1.0",
      payload: {
        page: { id: ASKFISH_CONTEXT.page, route: "/", title: "Peskas dashboard" },
        country: { code: country.countryCode, name: country.countryName },
        locale: lang,
        filters: {
          districts: picked,
          metric: ASKFISH_CONTEXT.metric,
          months: months ?? null,
          timeRangeLabel: months ? `Last ${months} months` : "All time",
        },
        requestedOperation: ASKFISH_CONTEXT.operation,
      },
    },
    restrictToCurrentPageAndFilters: false,
  };
}

/** Call AskFish's Peskas API (`/api/integration/peskas/<path>`) and return the `data` of its reply. */
async function askFish(path: string, body: object): Promise<unknown> {
  // ASKFISH SHARED TOKEN: Prefer the single common token when configured.
  // The dashboard server, never the browser, adds the credential.
  const base = process.env.ASKFISH_URL;
  if (!base) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AskFish backend URL is not configured." });
  const token = process.env.ASKFISH_SHARED_TOKEN || process.env.ASKFISH_BACKEND_TOKEN;
  if (!token) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AskFish backend authentication is not configured." });
  const response = await fetch(`${base.replace(/\/$/, "")}/api/integration/peskas/${path}`, {
    method: "POST",
    // ASKFISH INTEGRATION: Optional shared bearer token protects the public
    // AskFish backend from unauthenticated direct calls in production.
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    // Planning a question is one AI call; a minute means AskFish isn't answering.
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    // Python FastAPI uses {detail} for expected HTTPException failures.
    // Classify server-side; never send raw upstream bodies to the browser.
    const issue = describeAskFishFailure(
      response.status,
      await response.json().catch(() => null),
    );
    // HTTP failure classes are not all legal tRPC error codes.
    // Preserve the safe explanation while mapping to the supported tRPC vocabulary.
    const trpcCode =
      issue.code === "SERVICE_UNAVAILABLE" ? "INTERNAL_SERVER_ERROR" :
      issue.code === "BAD_GATEWAY" ? "TIMEOUT" : issue.code;
    throw new TRPCError({ code: trpcCode, message: `AskFish: ${issue.message}` });
  }
  return ((await response.json()) as { data?: unknown }).data;
}

/** A date AskFish sends (`2026-04-01`) as the month key the app formats, `2026-04`. */
const toMonthKey = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : null;


/**
 * A statistic's note as words. AskFish sends a group's dimensions as an object, or printed
 * into the text the way Python prints one (`{'district': 'Wete', 'month': '2026-04-01'}`):
 * either way only the values are for reading, "Wete, 2026-04-01".
 */
function readable(detail: unknown, label: string) {
  // The statistic's own label (a district, say) isn't repeated in its note.
  const said = (values: unknown[]) => values.filter((v) => v !== label).join(", ");
  if (detail && typeof detail === "object") return said(Object.values(detail));
  if (typeof detail !== "string") return null;
  return detail.replace(/\{([^{}]*)\}/g, (_, inside: string) =>
    said([...inside.matchAll(/: '([^']*)'/g)].map((m) => m[1])),
  );
}


/** What the chat needs of AskFish's reply; its plan, diagnostics and cost stay on the server. */
const reply = z.object({
  answer: z.object({
    headline: z.string(),
    narrative: z.string(),
    statistics: z.array(
      z.object({
        label: z.string(),
        value: z.number().nullish(),
        unit: z.string().nullish(),
        detail: z.unknown(),
      }),
    ),
    caveats: z.array(z.string()),
  }),
  charts: z.array(askFishChartSchema),
  provenance: z.array(
    z.object({
      measure: z.string(),
      measureLabel: z.string(),
      unit: z.string().nullish(),
      recordCount: z.number(),
      resolvedTimeWindow: z
        .object({ startDate: z.string().nullable(), endDate: z.string().nullable() })
        .nullish(),
    }),
  ),
});

/** AskFish's reply in the dashboard's terms. */
function answer(data: unknown) {
  const { answer, charts, provenance } = reply.parse(data);
  const metric = (measure: string) => (isMetricKey(measure) ? measure : null);

  /**
   * The dashboard metric a figure is in, so the chat formats it like every other
   * (`formatValue`: an estimate rounded, in its method's colour): the one of the
   * answer's measures whose unit it has, when they all format alike. Taxa
   * measures and counts of months or groups have none, and read as recorded.
   */
  const byUnit = (unit: string | null | undefined) => {
    const found = provenance.filter((p) => p.unit === unit).map((p) => metric(p.measure));
    const kinds = new Set(found.map((m) => m && !!METRICS[m].estimated));
    return kinds.size === 1 ? found[0] ?? null : null;
  };
  /** The measure a chart's title or axis names: AskFish starts both with the measure's label. */
  const byLabel = (text: string | null | undefined) => {
    const named = provenance
      .filter((p) => text?.startsWith(p.measureLabel))
      .sort((a, b) => b.measureLabel.length - a.measureLabel.length)[0];
    return named ? metric(named.measure) : null;
  };

  const drawnMethod = (...metrics: (MetricKey | null)[]) =>
    metrics.map((m) => m && estimateMethod(m)).find(Boolean) ?? null;
  const methods = new Set(provenance.map((p) => drawnMethod(metric(p.measure))));
  const answerMethod = methods.size === 1 ? [...methods][0]! : null;

  return {
    headline: answer.headline,
    narrative: answer.narrative,
    caveats: answer.caveats,
    /** It draws on an estimate, which AskFish reads by the GPS tracker method only. */
    estimated: provenance.some((p) => isMetricKey(p.measure) && METRICS[p.measure].estimated),
    statistics: answer.statistics.map((s) => ({
      label: s.label,
      value: s.value ?? null,
      unit: s.unit ?? null,
      detail: readable(s.detail, s.label),
      metric: byUnit(s.unit),
    })),
    charts: charts.map((c) => {
      const byMonth = c.series.every((s) => s.points.every((p) => toMonthKey(p.x)));
      // Lines and bars draw one measure, a scatter one on each axis; the others draw counts
      // (months found) or percentage changes, in no metric's unit.
      const values = c.type === "line" || c.type === "bar";
      return {
        type: c.type,
        title: c.title,
        xLabel: c.xLabel ?? null,
        yLabel: c.yLabel ?? null,
        sizeLabel: c.sizeLabel ?? null,
        sizeUnit: c.sizeUnit ?? null,
        note: c.note ?? null,
        /** `x` is a month key (`YYYY-MM`). */
        byMonth,
        /** The metric on each axis, when the axis is one. */
        metrics: {
          x: c.type === "scatter" || c.type === "bubble" ? byLabel(c.xLabel) : null,
          y: values ? byLabel(c.title) : c.type === "scatter" || c.type === "bubble" ? byLabel(c.yLabel) : null,
        },
        /** Preserve the official estimation method used for chart formatting. */
        method: values || c.type === "scatter" || c.type === "bubble"
          ? drawnMethod(
              c.type === "scatter" || c.type === "bubble" ? byLabel(c.xLabel) : null,
              values ? byLabel(c.title) : c.type === "scatter" || c.type === "bubble" ? byLabel(c.yLabel) : null,
            )
          : answerMethod,
        /** Lines at zero on both axes, for changes up and down. */
        zero: !!c.referenceLines?.length,
        series: c.series.map((s) => ({
          name: s.name,
          trend: s.role === "trendline",
          points: s.points.map((p) => ({
            x: byMonth ? toMonthKey(p.x)! : p.x,
            y: p.y,
            z: p.z ?? null,
            label: p.label ?? null,
          })),
        })),
      };
    }),
    sources: provenance.map((p) => ({
      label: p.measureLabel,
      records: p.recordCount,
      from: toMonthKey(p.resolvedTimeWindow?.startDate),
      through: toMonthKey(p.resolvedTimeWindow?.endDate),
    })),
  };
}

export const askfishRouter = createTRPCRouter({
  /** Questions AskFish has already checked it can answer for this page and these filters. */
  suggestions: publicProcedure.input(filters).query(async ({ input }) => {
    const data = await askFish("suggestions", contextFor(input));
    return z
      .object({ suggestions: z.array(z.object({ id: z.string(), question: z.string() })) })
      .parse(data).suggestions;
  }),

  /** One question, typed or picked from the suggestions. */
  ask: publicProcedure
    .input(
      filters.extend({
        question: z.string().trim().min(ASKFISH_QUESTION.min).max(ASKFISH_QUESTION.max),
        suggestionId: z.string().min(8).max(100).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const base = contextFor(input);
      // A picked suggestion runs the plan AskFish kept for it, with no AI call. AskFish keeps
      // those in memory for a while: one it no longer has fails, and the chat's "Try again"
      // asks it as a typed question.
      return answer(
        input.suggestionId
          ? await askFish("suggestions/ask", { ...base, suggestionId: input.suggestionId })
          : await askFish("ask", { ...base, question: input.question }),
      );
    }),
});
