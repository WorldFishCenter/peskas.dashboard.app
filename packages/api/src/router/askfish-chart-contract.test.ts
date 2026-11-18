import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createCallerFactory } from "../trpc";
import { askfishRouter } from "./askfish";

const caller = createCallerFactory(askfishRouter)({});
const input = { districts: [] as string[], months: 6, lang: "en" };

beforeEach(() => {
  process.env.VITE_COUNTRY_CODE = "TZ";
  process.env.ASKFISH_URL = "http://127.0.0.1:8000";
  process.env.ASKFISH_SHARED_TOKEN = "test-token-not-a-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubAskFish(data: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    Response.json({ data }, { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function postedBody(fetchMock: ReturnType<typeof stubAskFish>) {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  expect(init?.method).toBe("POST");
  return JSON.parse(String(init?.body));
}

test("dashboard-wide suggestions accept the current panel's districts/months/lang input", async () => {
  const fetchMock = stubAskFish({ suggestions: [] });
  await expect(caller.suggestions(input)).resolves.toEqual([]);
  const body = postedBody(fetchMock);
  expect(body.context.payload.page.id).toBe("catch_trends");
  expect(body.context.payload.requestedOperation).toBe("dashboard.semantic_context.v1");
  expect(body.restrictToCurrentPageAndFilters).toBe(false);
  expect(body.context.payload.filters.months).toBe(6);
  expect(body.context.payload.filters.districts.length).toBeGreaterThan(0);
});

test("dashboard-wide question accepts the same input and forwards the question", async () => {
  const fetchMock = stubAskFish({
    answer: { headline: "Test", narrative: "Test answer", statistics: [], caveats: [] },
    charts: [],
    provenance: [],
  });
  const result = await caller.ask({ ...input, question: "How much catch was estimated?" });
  expect(result.headline).toBe("Test");
  const body = postedBody(fetchMock);
  expect(body.question).toBe("How much catch was estimated?");
  expect(body.context.payload.filters.metric).toBe("mean_cpue");
});

test("unknown districts are still rejected before calling AskFish", async () => {
  const fetchMock = stubAskFish({ suggestions: [] });
  await expect(caller.suggestions({ ...input, districts: ["invalid-district-name"] })).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
