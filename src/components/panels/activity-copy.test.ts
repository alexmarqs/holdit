import { describe, expect, it } from "vitest";
import { activityLine } from "./activity-copy";

describe("activityLine", () => {
  it("states a new square as a grab, not a receipt", () => {
    expect(
      activityLine({
        kind: "bought_in",
        shareBefore: null,
        shareAfter: 0.084,
        amountCents: 1_000,
      }),
    ).toBe("took 8.4% · $10");
  });

  it("names the shrink when someone tops up", () => {
    expect(
      activityLine({
        kind: "topped_up",
        shareBefore: 0.021,
        shareAfter: 0.084,
        amountCents: 5_000,
      }),
    ).toBe("2.1% → 8.4% · everyone else shrank");
  });

  it("does not pretend a founding buy took 0%", () => {
    expect(
      activityLine({
        kind: "bought_in",
        shareBefore: null,
        shareAfter: 0,
        amountCents: 25_200,
      }),
    ).toBe("$252");
  });
});
