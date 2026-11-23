import { describe, expect, it } from "vitest";
import { describeAskFishFailure } from "./askfish-errors";

describe("AskFish failures the chat can explain", () => {
  it("names what the reader can change", () => {
    expect(
      describeAskFishFailure(422, {
        detail: "Trend analysis needs at least two dated observations per group.",
      }).reason,
    ).toBe("few-observations");
    expect(
      describeAskFishFailure(422, {
        detail: "Analysis groupBy 'time' is not available in monthly_district_summary.",
      }).reason,
    ).toBe("not-available");
    expect(
      describeAskFishFailure(422, {
        detail: "AskFish could not produce a valid semantic query plan after validation.",
      }).reason,
    ).toBe("no-plan");
    expect(describeAskFishFailure(429, null)).toEqual({
      code: "TOO_MANY_REQUESTS",
      reason: "busy",
    });
    expect(describeAskFishFailure(504, null)).toEqual({ code: "TIMEOUT", reason: "slow" });
  });
  it("keeps AskFish's own text and outages to itself", () => {
    expect(describeAskFishFailure(500, { detail: "MongoDB password=SECRET" })).toEqual({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(describeAskFishFailure(401, { detail: "super-secret" })).toEqual({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(describeAskFishFailure(422, { detail: [{ msg: "sk-secret" }] })).toEqual({
      code: "BAD_REQUEST",
    });
  });
});
