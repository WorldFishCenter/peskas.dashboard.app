/** Safe, client-facing classification of failures from the AskFish Python API.
 * Never forward upstream tracebacks, query payloads, provider error bodies, or secrets.
 * HTTP 200 answerability/no-data responses remain part of the normal answer contract.
 */
export type AskFishFailureCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "TOO_MANY_REQUESTS"
  | "SERVICE_UNAVAILABLE"
  | "BAD_GATEWAY"
  | "INTERNAL_SERVER_ERROR";

export type AskFishFailure = {
  code: AskFishFailureCode;
  message: string;
};

function extractDetail(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return "";
  const detail = (body as Record<string, unknown>).detail;
  // Only inspect this for classification. Never display it verbatim.
  return typeof detail === "string" ? detail.slice(0, 1200) : "";
}

/** Maps upstream failures to bounded, actionable messages. */
export function describeAskFishFailure(status: number, body: unknown): AskFishFailure {
  const detail = extractDetail(body).toLowerCase();
  if (status === 401 || status === 403) {
    return { code: "UNAUTHORIZED", message: "The AskFish service could not authenticate this request. Contact the dashboard administrator." };
  }
  if (status === 429) {
    return { code: "TOO_MANY_REQUESTS", message: "AskFish is receiving too many requests. Please try again shortly." };
  }
  if (status === 408 || status === 504) {
    return { code: "BAD_GATEWAY", message: "AskFish took too long to respond. Please try again." };
  }
  if (status === 422 || status === 400) {
    if (/at least two dated observations|insufficient observations|not enough observations|no shared month|no common month/.test(detail)) {
      return { code: "BAD_REQUEST", message: "There are not enough matching observations for this analysis. Try a wider time period or different groups." };
    }
    if (/after retries|could not produce a valid semantic|valid semantic query plan/.test(detail)) {
      return { code: "BAD_REQUEST", message: "AskFish could not construct a valid analysis plan for that question. Try naming the measure, district and time period more explicitly." };
    }
    if (/groupby|partitionby|not available in|outside the currently queryable|unsupported|not queryable|unknown measure|unknown dimension/.test(detail)) {
      return { code: "BAD_REQUEST", message: "That measure or grouping is not available in the current Peskas catalog. Try a supported measure or reporting level." };
    }
    return { code: "BAD_REQUEST", message: "AskFish could not validate this request. Try a more specific question or different filters." };
  }
  if (status === 502 || status === 503) {
    return { code: "SERVICE_UNAVAILABLE", message: "AskFish or its data source is temporarily unavailable. Please try again later." };
  }
  return { code: "INTERNAL_SERVER_ERROR", message: "AskFish encountered a server error. Please try again later." };
}
