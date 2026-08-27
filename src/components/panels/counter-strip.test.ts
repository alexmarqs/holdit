import { describe, expect, it } from "vitest";
import { visibleOnlineCount } from "./counter-strip";

describe("visibleOnlineCount", () => {
  it("includes the person currently viewing the page", () => {
    expect(visibleOnlineCount(null)).toBe(1);
    expect(visibleOnlineCount(0)).toBe(1);
  });

  it("preserves a larger server count", () => {
    expect(visibleOnlineCount(4)).toBe(4);
  });
});
