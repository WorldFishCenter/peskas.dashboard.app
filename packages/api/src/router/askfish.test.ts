import { beforeEach, expect, test, vi } from "vitest";
import { activeCountry } from "../lib/country";
import { createCallerFactory } from "../trpc";
import { askfishRouter } from "./askfish";

const askfish = createCallerFactory(askfishRouter)({});

const filters = { districts: ["Wete"], months: 6, lang: "sw" };

/** AskFish's reply to a question, as `ask_data` builds it, with the parts the chat never sees. */
const REPLY = {
  question: "How has the catch changed?",
  scopeMode: "restricted",
  answer: {
    headline: "Estimated catch rose",
    narrative: "From April to September.",
    statistics: [
      {
        label: "Wete",
        value: 1234.5,
        unit: "tonnes",
        // The way AskFish prints a change's two ends.
        detail:
          "{'district': 'Wete', 'month': '2026-04-01'} → {'district': 'Wete', 'month': '2026-09-01'}",
      },
      { label: "Observed periods", value: 6, unit: "periods", detail: { district: "Wete" } },
    ],
    caveats: ["Upstream derivation is unverified."],
  },
  planner: { answerability: "query" },
  charts: [
    {
      type: "line",
      title: "Estimated catch",
      xLabel: "Month",
      yLabel: "Estimated catch (tonnes)",
      xType: "date",
      series: [{ name: "Wete", mode: "lines+markers", points: [{ x: "2026-04-01", y: 10 }] }],
    },
  ],
  provenance: [
    {
      dataset: "monthly_district_summary",
      measure: "estimated_catch_tn",
      measureLabel: "Estimated catch",
      unit: "tonnes",
      recordCount: 6,
      resolvedTimeWindow: {
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-09-30T23:59:59.999Z",
        basis: "rolling_months",
      },
    },
  ],
  diagnostics: {},
  cost: { total_cost: 0.01 },
};

const reply = (data: unknown, status = 200) => Response.json({ status: true, data }, { status });
const fetchMock = vi.fn<typeof fetch>();
/** The path and JSON body of each call made to AskFish. */
const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    path: String(url).replace("http://askfish.test/api/integration/peskas/", ""),
    headers: init?.headers as Record<string, string>,
    body: JSON.parse(String(init?.body)),
  }));

beforeEach(() => {
  process.env.VITE_COUNTRY_CODE = "TZ";
  process.env.ASKFISH_URL = "http://askfish.test/";
  // Never a developer's real token in an intercepted request.
  process.env.ASKFISH_SHARED_TOKEN = "test-shared-token";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

test("AskFish gets the page as its contract words it, and the chat only what it draws", async () => {
  fetchMock.mockResolvedValueOnce(reply(REPLY));
  const answer = await askfish.ask({ ...filters, question: "  How has the catch changed?  " });

  const [call] = calls();
  expect(call!.path).toBe("ask");
  expect(call!.headers.authorization).toBe("Bearer test-shared-token");
  expect(call!.body).toEqual({
    question: "How has the catch changed?",
    // One chat for the whole dashboard: every question may use all the country's data.
    restrictToCurrentPageAndFilters: false,
    context: {
      type: "PESKAS_PAGE_CONTEXT",
      version: "1.0",
      payload: {
        page: { id: "catch_trends", route: "/", title: "Peskas dashboard" },
        // The server's country, whatever the browser says.
        country: { code: "TZ", name: "Zanzibar" },
        locale: "sw",
        filters: {
          districts: ["Wete"],
          metric: "mean_cpue",
          months: 6,
          timeRangeLabel: "Last 6 months",
        },
        requestedOperation: "dashboard.semantic_context.v1",
      },
    },
  });

  expect(Object.keys(answer).sort()).toEqual(
    ["caveats", "charts", "estimated", "headline", "narrative", "sources", "statistics"].sort(),
  );
  // An answer about an estimate: its figures are in that metric, so rounded; its counts are not.
  expect(answer.estimated).toBe(true);
  expect(answer.statistics).toEqual([
    {
      label: "Wete",
      value: 1234.5,
      unit: "tonnes",
      // The label's own district isn't repeated.
      detail: "2026-04-01 → 2026-09-01",
      metric: "estimated_catch_tn",
    },
    { label: "Observed periods", value: 6, unit: "periods", detail: "Wete", metric: null },
  ]);
  // Dates cross the wire as month keys.
  expect(answer.charts[0]).toMatchObject({
    byMonth: true,
    metrics: { x: null, y: "estimated_catch_tn" },
  });
  expect(answer.charts[0]!.series[0]!.points).toEqual([{ x: "2026-04", y: 10, label: null }]);
  expect(answer.sources).toEqual([
    { label: "Estimated catch", records: 6, from: "2026-04", through: "2026-09" },
  ]);
});

test("another country's district or language never reaches AskFish, and no district stands for all", async () => {
  await expect(
    askfish.ask({ ...filters, districts: ["Mombasa"], question: "How much?" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(
    askfish.ask({ ...filters, lang: "fr", question: "How much?" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(fetchMock).not.toHaveBeenCalled();

  fetchMock.mockResolvedValueOnce(reply(REPLY));
  await askfish.ask({ ...filters, districts: [], question: "How much?" });
  expect(calls()[0]!.body.context.payload.filters.districts).toEqual(activeCountry().districts);
});

test("an answer on two measures keeps each figure in its own metric", async () => {
  const source = (measure: string, measureLabel: string, unit: string) => ({
    ...REPLY.provenance[0],
    measure,
    measureLabel,
    unit,
  });
  fetchMock.mockResolvedValueOnce(
    reply({
      ...REPLY,
      answer: {
        ...REPLY.answer,
        statistics: [
          { label: "Kati", value: 2000.4, unit: "tonnes", detail: null },
          { label: "Kati", value: 1.95, unit: "kg/fisher/hour", detail: null },
          { label: "Matching groups", value: 11, unit: "groups", detail: "Kati, Wete" },
        ],
      },
      charts: [
        { ...REPLY.charts[0], title: "Catch rate", yLabel: "Catch rate (kg/fisher/hour)" },
        {
          type: "scatter",
          title: "Estimated catch vs Catch rate",
          xLabel: "Estimated catch (tonnes)",
          yLabel: "Catch rate (kg/fisher/hour)",
          series: [{ name: "Kati", points: [{ x: 2000.4, y: 1.95 }] }],
        },
        {
          type: "quadrant",
          title: "Change in Estimated catch vs Catch rate",
          xLabel: "Estimated catch change (%)",
          yLabel: "Catch rate change (%)",
          referenceLines: [
            { axis: "x", value: 0, label: "No change" },
            { axis: "y", value: 0, label: "No change" },
          ],
          series: [{ name: "District", points: [{ x: 12, y: -3, label: "Kati" }] }],
        },
      ],
      provenance: [
        source("mean_cpue", "Catch rate", "kg/fisher/hour"),
        source("estimated_catch_tn", "Estimated catch", "tonnes"),
      ],
    }),
  );
  const answer = await askfish.ask({ ...filters, question: "Rate against catch?" });

  expect(answer.statistics.map((s) => s.metric)).toEqual(["estimated_catch_tn", "mean_cpue", null]);
  expect(answer.charts.map((c) => c.metrics)).toEqual([
    // The recorded line is the recorded metric, though the answer also reads an estimate.
    { x: null, y: "mean_cpue" },
    { x: "estimated_catch_tn", y: "mean_cpue" },
    // Percentage changes are in no metric's unit.
    { x: null, y: null },
  ]);
  expect(answer.charts[2]!.zero).toBe(true);
});

test("a suggestion runs AskFish's kept plan, and a failure is not hidden", async () => {
  fetchMock.mockResolvedValueOnce(
    reply({
      suggestions: [{ id: "suggestion-1", question: "Which month peaked?", category: "x" }],
    }),
  );
  expect(await askfish.suggestions(filters)).toEqual([
    { id: "suggestion-1", question: "Which month peaked?" },
  ]);

  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(reply(REPLY));
  const picked = { ...filters, question: "Which month peaked?", suggestionId: "suggestion-1" };
  expect((await askfish.ask(picked)).headline).toBe("Estimated catch rose");
  expect(calls().map((c) => [c.path, c.body.suggestionId])).toEqual([
    ["suggestions/ask", "suggestion-1"],
  ]);

  // A suggestion AskFish no longer keeps, or AskFish down: the question fails (the chat
  // offers "Try again", which asks it typed) rather than answering with nothing.
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ detail: "Unknown suggestion." }, { status: 422 }));
  await expect(askfish.ask(picked)).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("without the shared token nothing is sent to AskFish", async () => {
  delete process.env.ASKFISH_SHARED_TOKEN;
  await expect(askfish.ask({ ...filters, question: "How much?" })).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a kind of chart the chat can't draw is left out", async () => {
  fetchMock.mockResolvedValueOnce(
    reply({ ...REPLY, charts: [{ ...REPLY.charts[0], type: "heatmap" }, REPLY.charts[0]] }),
  );
  const answer = await askfish.ask({ ...filters, question: "How much?" });
  expect(answer.charts.map((c) => c.type)).toEqual(["line"]);
});

test.each([
  ["KE", "Kenya", "Kilifi North"],
  ["TZ", "Zanzibar", "Wete"],
  ["MZ", "Mozambique", "Moma"],
] as const)("server-derived %s context uses common bearer token", async (code, name, district) => {
  process.env.VITE_COUNTRY_CODE = code;
  fetchMock.mockResolvedValueOnce(reply(REPLY));
  await askfish.ask({ ...filters, districts: [district], question: "How has catch changed?" });
  const [call] = calls();
  expect(call!.body.context.payload.country).toEqual({ code, name });
  expect(call!.headers.authorization).toBe("Bearer test-shared-token");
});
