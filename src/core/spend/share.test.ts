import { describe, expect, it } from "vitest";
import { ceilingFor, MAX_SHARE } from "../config";
import { computeShares, minShareFor } from "./share";

const sum = (rows: { share: number }[]) => rows.reduce((s, r) => s + r.share, 0);
const of = (rows: { id: string; share: number }[], id: string) =>
  rows.find((r) => r.id === id)?.share ?? 0;

/** Background squares, enough that the 10% ceiling is live and non-binding. */
const filler = (n: number, cents = 10_000) =>
  Array.from({ length: n }, (_, i) => ({ id: `f${i}`, liveCents: cents }));

describe("computeShares", () => {
  it("returns nothing for an empty map", () => {
    expect(computeShares([])).toEqual([]);
  });

  it("splits proportionally when nothing is clamped", () => {
    const rows = computeShares([
      { id: "a", liveCents: 30_000 },
      { id: "b", liveCents: 10_000 },
      ...filler(60, 5_000),
    ]);
    expect(sum(rows)).toBeCloseTo(1, 10);
    expect(of(rows, "a") / of(rows, "b")).toBeCloseTo(3, 6);
    expect(rows.some((r) => r.capped)).toBe(false);
  });

  it("caps a whale and still fills the map", () => {
    const rows = computeShares([{ id: "whale", liveCents: 100_000_000 }, ...filler(40)]);
    expect(of(rows, "whale")).toBeCloseTo(0.1, 10);
    expect(sum(rows)).toBeCloseTo(1, 10);
    expect(rows.find((r) => r.id === "whale")?.capped).toBe(true);
  });

  it("redistributes overflow proportionally among the uncapped", () => {
    const rows = computeShares([
      { id: "whale", liveCents: 100_000_000 },
      { id: "big", liveCents: 40_000 },
      { id: "small", liveCents: 10_000 },
      ...filler(100),
    ]);
    expect(of(rows, "big") / of(rows, "small")).toBeCloseTo(4, 6);
    expect(of(rows, "big")).toBeLessThan(0.1);
  });

  it("also caps a square that only crosses the ceiling after redistribution", () => {
    const rows = computeShares([
      { id: "whale", liveCents: 100_000_000 },
      { id: "big", liveCents: 40_000 },
      ...filler(40, 5_000),
    ]);
    expect(of(rows, "big")).toBeCloseTo(0.1, 10);
    expect(rows.find((r) => r.id === "big")?.capped).toBe(true);
  });

  it("leaves the cap loose while there are too few squares to satisfy it", () => {
    // Four squares cannot fill a map at 10% each. On a map this young the
    // biggest spender really does dominate, and the map should say so — though
    // 60% is now above the four-square ceiling, so it is trimmed to it.
    const rows = computeShares([
      { id: "a", liveCents: 60_000 },
      { id: "b", liveCents: 20_000 },
      { id: "c", liveCents: 15_000 },
      { id: "d", liveCents: 5_000 },
    ]);
    expect(sum(rows)).toBeCloseTo(1, 10);
    expect(of(rows, "a")).toBeCloseTo(ceilingFor(4), 10);
    // Well clear of the settled 10%: a young wall still shows who is paying.
    expect(ceilingFor(4)).toBeGreaterThan(3 * MAX_SHARE);
  });

  it("stops one square swallowing a young wall", () => {
    // Four squares, one paying ten thousand times the others. Without a
    // young-wall ceiling this reached 99.8% and left the rest at the minimum
    // tile size.
    const rows = computeShares([
      { id: "whale", liveCents: 100_000_000 },
      { id: "a", liveCents: 10_000 },
      { id: "b", liveCents: 10_000 },
      { id: "c", liveCents: 10_000 },
    ]);
    expect(of(rows, "whale")).toBeCloseTo(ceilingFor(4), 10);
    expect(rows.find((r) => r.id === "whale")?.capped).toBe(true);
    expect(sum(rows)).toBeCloseTo(1, 10);
    // What is left over is shared, so every other square stays clearly visible.
    const rest = (1 - ceilingFor(4)) / 3;
    for (const id of ["a", "b", "c"]) expect(of(rows, id)).toBeCloseTo(rest, 8);
  });

  it("leaves a young wall alone when nobody exceeds the ceiling", () => {
    // The ceiling must only bite on the square trying to pass it; everyone
    // under it keeps their exact proportions.
    const rows = computeShares([
      { id: "a", liveCents: 50_000 },
      { id: "b", liveCents: 30_000 },
      { id: "c", liveCents: 20_000 },
    ]);
    expect(of(rows, "a")).toBeCloseTo(0.5, 10);
    expect(of(rows, "b")).toBeCloseTo(0.3, 10);
    expect(of(rows, "c")).toBeCloseTo(0.2, 10);
    expect(rows.some((r) => r.capped)).toBe(false);
  });

  it("holds a whale to the ceiling of the wall it is on", () => {
    const rows = computeShares([{ id: "whale", liveCents: 10_000_000 }, ...filler(9, 1_000)]);
    expect(of(rows, "whale")).toBeCloseTo(ceilingFor(10), 10);
    expect(sum(rows)).toBeCloseTo(1, 10);
  });

  /*
   * The reason the ceiling never lands on 1/n. At exactly that value the cap
   * binds every square at once — equal shares are the only distribution where
   * nobody exceeds 1/n and they still total the wall — so a flat 10% cap at ten
   * squares rendered a 19-dollar square and a 354-dollar square identically.
   */
  it("never flattens the wall, however lopsided the spending", () => {
    for (const n of [10, 11, 12, 13, 16, 20, 40]) {
      const rows = computeShares([
        { id: "whale", liveCents: 10_000_000 },
        { id: "minnow", liveCents: 100 },
        ...filler(n - 2, 50_000),
      ]);
      expect(sum(rows), `n=${n}`).toBeCloseTo(1, 10);
      expect(of(rows, "whale"), `n=${n}`).toBeGreaterThan(of(rows, "minnow") * 1.5);
    }
  });

  it("settles on the display cap once the wall is grown", () => {
    for (const n of [16, 20, 50, 200]) {
      expect(ceilingFor(n), `n=${n}`).toBeCloseTo(MAX_SHARE, 10);
    }
  });

  it("floors the tail and funds it from squares with headroom", () => {
    const rows = computeShares(
      [{ id: "big", liveCents: 10_000_000 }, { id: "dust", liveCents: 1 }, ...filler(30)],
      { minShare: 0.01 },
    );
    expect(of(rows, "dust")).toBeCloseTo(0.01, 10);
    expect(rows.find((r) => r.id === "dust")?.floored).toBe(true);
    expect(sum(rows)).toBeCloseTo(1, 8);
  });

  it("keeps the raw share visible once clamped", () => {
    const rows = computeShares([{ id: "whale", liveCents: 900_000 }, ...filler(30, 100)]);
    const whale = rows.find((r) => r.id === "whale")!;
    expect(whale.rawShare).toBeGreaterThan(whale.share);
  });

  it("shares the map equally when nothing is live at all", () => {
    const rows = computeShares(filler(20, 0));
    expect(sum(rows)).toBeCloseTo(1, 10);
    expect(of(rows, "f0")).toBeCloseTo(1 / 20, 10);
  });
});

describe("minShareFor", () => {
  it("expresses a pixel floor as a share", () => {
    expect(minShareFor(460, 460_000)).toBeCloseTo(0.001, 10);
    expect(minShareFor(460, 0)).toBe(0);
  });
});
