import { describe, expect, it } from "vitest";
import { describeAskFishFailure } from "./askfish-errors";

describe("safe AskFish upstream errors", () => {
  it("explains insufficient observations without leaking upstream text", () => {
    expect(describeAskFishFailure(422, { detail: "Trend analysis needs at least two dated observations per group." }).message).toContain("not enough matching observations");
  });
  it("explains schema/semantic validation", () => {
    expect(describeAskFishFailure(422, { detail: "Analysis groupBy 'time' is not available in monthly_district_summary." }).message).toContain("grouping");
  });
  it("explains planner exhaustion separately", () => {
    expect(describeAskFishFailure(422, { detail: "AskFish could not produce a valid semantic query plan after validation." }).message).toContain("analysis plan");
  });
  it("never shows secrets or stack traces", () => {
    const result = describeAskFishFailure(500, { detail: "MongoDB password=SECRET; stack: /Users/person/app.py" });
    expect(result.message).not.toMatch(/SECRET|MongoDB|Users|stack/);
  });
  it("maps upstream auth and temporary outages", () => {
    expect(describeAskFishFailure(401, { detail: "super-secret" }).code).toBe("UNAUTHORIZED");
    expect(describeAskFishFailure(503, null).code).toBe("SERVICE_UNAVAILABLE");
    expect(describeAskFishFailure(429, null).code).toBe("TOO_MANY_REQUESTS");
  });
  it("never forwards a malformed detail object", () => {
    const result = describeAskFishFailure(422, { detail: [{ msg: "sk-secret" }] });
    expect(result.message).not.toContain("sk-secret");
  });
});
