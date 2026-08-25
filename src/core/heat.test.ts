import { describe, expect, it } from "vitest";
import { MS_PER_DAY } from "./config";
import { heatLevel } from "./heat";

const NOW = Date.UTC(2026, 7, 21);
const daysAgo = (d: number) => NOW - d * MS_PER_DAY;

describe("heatLevel", () => {
  it("is hottest at purchase time and cold beyond the window", () => {
    expect(heatLevel(NOW, NOW)).toBe(1);
    expect(heatLevel(daysAgo(20), NOW)).toBe(0);
  });

  it("is cold for a square that has never been bought", () => {
    expect(heatLevel(null, NOW)).toBe(0);
  });

  it("decreases monotonically with age", () => {
    const levels = [0, 1, 3, 7, 12].map((d) => heatLevel(daysAgo(d), NOW));
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeLessThan(levels[i - 1]!);
  });

  it("stays inside 0–1 for any input", () => {
    for (const d of [-5, 0, 0.5, 2, 5, 9, 14, 40]) {
      const level = heatLevel(daysAgo(d), NOW);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });

  it("reserves the bright end for the last day or two", () => {
    // A square topped up a week ago should read clearly cooler than a fresh one,
    // otherwise size and warmth stop being two separate readings.
    expect(heatLevel(daysAgo(7), NOW)).toBeLessThan(0.2);
    expect(heatLevel(daysAgo(1), NOW)).toBeGreaterThan(0.6);
  });
});
