import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  ASKFISH_MAX_MONTHS,
  ASKFISH_PAGE_IDS,
  ASKFISH_PAGES,
  ASKFISH_QUESTION,
  askFishKnows,
} from "@repo/domain/askfish";
import { isMetricKey, METRICS } from "@repo/domain/metrics";
import { activeCountry, scopeDistricts } from "../lib/country";
import { createTRPCRouter, publicProcedure } from "../trpc";

/*
 * AskFish for the dashboard's own chat (the app's `components/askfish`). The
 * browser sends the page, its filters and the question. This server adds what
 * the browser isn't trusted with (the country, AskFish's address), asks the
 * AskFish service and returns only what the chat draws.
 * AskFish, in turn, reads the data through `/api/askfish` (`../askfish/handler.ts`).
 *
 * ponytail: nothing here limits how often a visitor asks, and every question
 * costs an AI call on the AskFish side. Rate-limit `/api/trpc/askfish.*` in
 * the Vercel Firewall; move the limit into code if that proves too coarse.
 */

const scope = z.object({
  page: z.enum(ASKFISH_PAGE_IDS),
  /** The page's metric; one AskFish knows on that page. */
  metric: z.string(),
  /** Districts of the active country, at least one: AskFish takes no question without. */
  districts: z.array(z.string()).min(1),
  /** The last `months` complete months; all of them when left out. */
  months: z.number().int().positive().max(ASKFISH_MAX_MONTHS).optional(),
  lang: z.string().min(2).max(5),
  /** Answer from this page and its filters only, or from all the country's data AskFish may read. */
  restrict: z.boolean(),
});
type Scope = z.infer<typeof scope>;

/**
 * What every AskFish call starts from: the page and its filters as AskFish's
 * contract words them, checked against the active country, and the scope.
 */
function request({ page, metric, districts, months, lang, restrict }: Scope) {
  scopeDistricts(districts);
  if (!askFishKnows(page, metric)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `AskFish has no ${metric} on ${page}` });
  }
  const country = activeCountry();
  const context = {
    type: "PESKAS_PAGE_CONTEXT",
    version: "1.0",
    payload: {
      // The contract asks for a route and a title; AskFish reads neither.
      page: { id: page, route: `/${page}`, title: page },
      country: { code: country.countryCode, name: country.countryName },
      locale: lang,
      filters: {
        districts,
        metric,
        months: months ?? null,
        // AskFish's planner reads this label, in English.
        timeRangeLabel: months ? `Last ${months} months` : "All time",
      },
      // ASKFISH INTEGRATION: The legacy Catch Trends endpoint only accepts
      // mean_cpue/estimated_catch_tn. Other Catch metrics are valid semantic
      // queries, but must not falsely advertise the legacy operation.
      requestedOperation:
        page === "catch_trends" && !["mean_cpue", "estimated_catch_tn"].includes(metric)
          ? "dashboard.semantic_context.v1"
          : ASKFISH_PAGES[page].operation,
    },
  };
  return { context, restrictToCurrentPageAndFilters: restrict };
}

/** Call AskFish's Peskas API (`/api/integration/peskas/<path>`) and return the `data` of its reply. */
async function askFish(path: string, body: object): Promise<unknown> {
  // ponytail: AskFish doesn't yet check who calls it, so no secret is sent; add the header once it does.
  const base = process.env.ASKFISH_URL;
  if (!base) throw new Error("ASKFISH_URL is not defined");
  const response = await fetch(`${base.replace(/\/$/, "")}/api/integration/peskas/${path}`, {
    method: "POST",
    // ASKFISH INTEGRATION: Optional shared bearer token protects the public
    // AskFish backend from unauthenticated direct calls in production.
    headers: {
      "content-type": "application/json",
      ...(process.env.ASKFISH_BACKEND_TOKEN
        ? { authorization: `Bearer ${process.env.ASKFISH_BACKEND_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(body),
    // Planning a question is one AI call; a minute means AskFish isn't answering.
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(
      `AskFish ${path} answered ${response.status}: ${(await response.text()).slice(0, 500)}`,
    );
  }
  return ((await response.json()) as { data?: unknown }).data;
}

/** A date AskFish sends (`2026-04-01`) as the month key the app formats, `2026-04`. */
const toMonthKey = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : null;

const point = z.object({
  x: z.union([z.string(), z.number()]),
  y: z.number(),
  label: z.string().nullish(),
});

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

/** A chart as AskFish describes it: plain series, drawn by the dashboard's own charts. */
const chart = z.object({
  type: z.string(),
  title: z.string(),
  xLabel: z.string().nullish(),
  yLabel: z.string().nullish(),
  note: z.string().nullish(),
  referenceLines: z.array(z.unknown()).nullish(),
  series: z.array(
    z.object({ name: z.string(), role: z.string().nullish(), points: z.array(point) }),
  ),
});

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
  charts: z.array(chart),
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
        note: c.note ?? null,
        /** `x` is a month key (`YYYY-MM`). */
        byMonth,
        /** The metric on each axis, when the axis is one. */
        metrics: {
          x: c.type === "scatter" ? byLabel(c.xLabel) : null,
          y: values ? byLabel(c.title) : c.type === "scatter" ? byLabel(c.yLabel) : null,
        },
        /** Lines at zero on both axes, for changes up and down. */
        zero: !!c.referenceLines?.length,
        series: c.series.map((s) => ({
          name: s.name,
          trend: s.role === "trendline",
          points: s.points.map((p) => ({
            x: byMonth ? toMonthKey(p.x)! : p.x,
            y: p.y,
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
  suggestions: publicProcedure.input(scope).query(async ({ input }) => {
    const data = await askFish("suggestions", request(input));
    return z
      .object({ suggestions: z.array(z.object({ id: z.string(), question: z.string() })) })
      .parse(data).suggestions;
  }),

  /** One question, typed or picked from the suggestions. */
  ask: publicProcedure
    .input(
      scope.extend({
        question: z.string().trim().min(ASKFISH_QUESTION.min).max(ASKFISH_QUESTION.max),
        suggestionId: z.string().min(8).max(100).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const base = request(input);
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
