import { describe, expect, it } from "vitest";
import { clipTagline, TAGLINE_MAX_CHARS } from "./config";

const NINETY =
  "As an utility, municipal utility, grid operator & solution provider, digitize your energy.";

describe("clipTagline", () => {
  it("keeps a line that used to be the whole stored tagline", () => {
    expect(NINETY.length).toBeGreaterThan(80);
    expect(NINETY.length).toBeLessThan(TAGLINE_MAX_CHARS);
    expect(clipTagline(NINETY)).toBe(NINETY);
  });

  it("still clips a description that will not fit three lines", () => {
    const long = `${"word ".repeat(80)}end`;
    const clipped = clipTagline(long);
    expect(clipped).not.toBeNull();
    expect(clipped!.endsWith("…")).toBe(true);
    expect(clipped!.length).toBeLessThanOrEqual(TAGLINE_MAX_CHARS);
  });

  it("is room for three lines on a large tile or the listing, not one 90-character line", () => {
    expect(TAGLINE_MAX_CHARS).toBeGreaterThanOrEqual(200);
  });
});
