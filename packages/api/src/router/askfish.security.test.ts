import { afterEach, expect, test, vi } from "vitest";
import { createCallerFactory } from "../trpc";
import { askfishRouter } from "./askfish";

const caller = createCallerFactory(askfishRouter)({});
const input = { districts: [] as string[], months: 6, lang: "en" };

const original = {
  shared: process.env.ASKFISH_SHARED_TOKEN,
  legacy: process.env.ASKFISH_BACKEND_TOKEN,
  url: process.env.ASKFISH_URL,
  country: process.env.VITE_COUNTRY_CODE,
};
afterEach(() => {
  if (original.shared === undefined) delete process.env.ASKFISH_SHARED_TOKEN;
  else process.env.ASKFISH_SHARED_TOKEN = original.shared;
  if (original.legacy === undefined) delete process.env.ASKFISH_BACKEND_TOKEN;
  else process.env.ASKFISH_BACKEND_TOKEN = original.legacy;
  if (original.url === undefined) delete process.env.ASKFISH_URL;
  else process.env.ASKFISH_URL = original.url;
  if (original.country === undefined) delete process.env.VITE_COUNTRY_CODE;
  else process.env.VITE_COUNTRY_CODE = original.country;
  vi.unstubAllGlobals();
});

test("AskFish suggestions fail closed with no configured backend credential", async () => {
  process.env.VITE_COUNTRY_CODE = "TZ";
  process.env.ASKFISH_URL = "http://127.0.0.1:8000";
  delete process.env.ASKFISH_SHARED_TOKEN;
  delete process.env.ASKFISH_BACKEND_TOKEN;
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(caller.suggestions(input)).rejects.toThrow(/authentication is not configured/i);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("Authenticated AskFish request sends token server-side", async () => {
  process.env.VITE_COUNTRY_CODE = "TZ";
  process.env.ASKFISH_URL = "http://127.0.0.1:8000";
  process.env.ASKFISH_SHARED_TOKEN = "test-only-token-do-not-use";
  delete process.env.ASKFISH_BACKEND_TOKEN;
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer test-only-token-do-not-use");
    return Response.json({ data: { suggestions: [] } });
  });
  vi.stubGlobal("fetch", fetchMock);
  await expect(caller.suggestions(input)).resolves.toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
