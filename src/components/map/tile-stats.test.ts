import { describe, expect, it } from "vitest";
import { tileStatsLine } from "./tile-layer";

describe("tileStatsLine", () => {
  it("prints the live share", () => {
    expect(tileStatsLine(0.3336, 0)).toBe("33.36%");
  });

  it("adds clicks once there are enough of them", () => {
    expect(tileStatsLine(0.3336, 12)).toBe("33.36% · 12 clicks");
  });

  it("drops the share while a new preview is packed — those numbers will move", () => {
    expect(tileStatsLine(0.3336, 0, true)).toBeUndefined();
    expect(tileStatsLine(0.3336, 12, true)).toBe("12 clicks");
  });
});
