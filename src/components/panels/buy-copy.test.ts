import { describe, expect, it } from "vitest";
import { holdCapCopy } from "./buy-copy";

describe("holdCapCopy", () => {
  it("says you keep the cap until others add that much, not that the dollars last", () => {
    expect(holdCapCopy(10_000, 0.32, 20_200)).toBe(
      "32.0% is the cap. $100 keeps 32.0% until others add $202",
    );
    expect(holdCapCopy(100_000, 0.32, 211_400)).toBe(
      "32.0% is the cap. $1,000 keeps 32.0% until others add $2,114",
    );
  });

  it("makes a thin hold look as thin as it is", () => {
    expect(holdCapCopy(600, 0.32, 200)).toBe(
      "32.0% is the cap. $6 keeps 32.0% until others add $2",
    );
  });
});
