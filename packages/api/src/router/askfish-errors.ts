/**
 * A failed AskFish call as the chat words it: a tRPC code and, where the reader
 * can act on it, a reason the chat translates (`text-askfish-error-<reason>`).
 * AskFish's own error text is read only to classify, never shown.
 */
export type AskFishReason = "few-observations" | "no-plan" | "not-available" | "busy" | "slow";

export type AskFishFailure = {
  code: "BAD_REQUEST" | "TOO_MANY_REQUESTS" | "TIMEOUT" | "INTERNAL_SERVER_ERROR";
  reason?: AskFishReason;
};

function extractDetail(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return "";
  const detail = (body as Record<string, unknown>).detail;
  return typeof detail === "string" ? detail.slice(0, 1200) : "";
}

export function describeAskFishFailure(status: number, body: unknown): AskFishFailure {
  const detail = extractDetail(body).toLowerCase();
  if (status === 429) return { code: "TOO_MANY_REQUESTS", reason: "busy" };
  if (status === 408 || status === 504) return { code: "TIMEOUT", reason: "slow" };
  if (status === 400 || status === 422) {
    if (
      /at least two dated observations|insufficient observations|not enough observations|no shared month|no common month/.test(
        detail,
      )
    ) {
      return { code: "BAD_REQUEST", reason: "few-observations" };
    }
    if (/after retries|could not produce a valid semantic|valid semantic query plan/.test(detail)) {
      return { code: "BAD_REQUEST", reason: "no-plan" };
    }
    if (
      /groupby|partitionby|not available in|outside the currently queryable|unsupported|not queryable|unknown measure|unknown dimension/.test(
        detail,
      )
    ) {
      return { code: "BAD_REQUEST", reason: "not-available" };
    }
    return { code: "BAD_REQUEST" };
  }
  return { code: "INTERNAL_SERVER_ERROR" };
}
