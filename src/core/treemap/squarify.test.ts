import { describe, expect, it } from "vitest";
import { squarify } from "./squarify";

const RECT = { x: 0, y: 0, w: 900, h: 540 };
const items = (weights: number[]) =>
  weights.map((weight, i) => ({ id: `i${i}`, weight })).sort((a, b) => b.weight - a.weight);

describe("squarify", () => {
  it("returns nothing for an empty set or a degenerate rect", () => {
    expect(squarify([], RECT)).toEqual([]);
    expect(squarify(items([1, 2]), { x: 0, y: 0, w: 0, h: 100 })).toEqual([]);
  });

  it("gives a single item the whole rect", () => {
    const [tile] = squarify(items([5]), RECT);
    expect(tile).toMatchObject(RECT);
  });

  it("conserves total area", () => {
    const placed = squarify(items([50, 30, 12, 5, 2, 1]), RECT);
    const area = placed.reduce((s, t) => s + t.w * t.h, 0);
    expect(area).toBeCloseTo(RECT.w * RECT.h, 3);
  });

  it("allocates area in proportion to weight", () => {
    const placed = squarify(items([60, 30, 10]), RECT);
    const area = (id: string) => {
      const t = placed.find((p) => p.id === id)!;
      return t.w * t.h;
    };
    expect(area("i0") / area("i1")).toBeCloseTo(2, 4);
    expect(area("i0") / area("i2")).toBeCloseTo(6, 4);
  });

  it("stays inside the rect", () => {
    for (const t of squarify(items([40, 25, 15, 9, 6, 3, 2]), RECT)) {
      expect(t.x).toBeGreaterThanOrEqual(-1e-9);
      expect(t.y).toBeGreaterThanOrEqual(-1e-9);
      expect(t.x + t.w).toBeLessThanOrEqual(RECT.w + 1e-6);
      expect(t.y + t.h).toBeLessThanOrEqual(RECT.h + 1e-6);
    }
  });

  it("does not overlap", () => {
    const placed = squarify(items([40, 25, 15, 9, 6, 3, 2]), RECT);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        const disjoint =
          a.x + a.w <= b.x + 1e-6 ||
          b.x + b.w <= a.x + 1e-6 ||
          a.y + a.h <= b.y + 1e-6 ||
          b.y + b.h <= a.y + 1e-6;
        expect(disjoint).toBe(true);
      }
    }
  });

  it("produces reasonably square tiles for the dominant items", () => {
    const placed = squarify(items([30, 25, 20, 15, 10]), { x: 0, y: 0, w: 600, h: 600 });
    for (const t of placed) {
      const aspect = Math.max(t.w / t.h, t.h / t.w);
      expect(aspect).toBeLessThan(3);
    }
  });

  it("drops zero and negative weights", () => {
    const placed = squarify(
      [
        { id: "a", weight: 10 },
        { id: "b", weight: 0 },
        { id: "c", weight: -4 },
      ],
      RECT,
    );
    expect(placed.map((p) => p.id)).toEqual(["a"]);
  });
});
