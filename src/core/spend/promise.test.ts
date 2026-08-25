import { formatShare } from "@holdit/utils/format";
import { describe, expect, it } from "vitest";
import { ceilingFor } from "../config";
import { centsForShareOf, shareAfterSpend } from "./project";
import { computeShares } from "./share";

/*
 * A wall the shape of a real one: 45 squares, spend in dollars on a power law
 * from $420 down to $1. The ceiling only binds past ten squares and the water
 * fill only has anywhere to go when the tail is long, so a handful of round
 * numbers would pass these tests without exercising either.
 *
 * Deliberately a copy rather than an import of the development seed data, which
 * is SQL applied to the local container and no longer reachable from here.
 */
const WALL_SPENDS = [
  420, 260, 95, 40, 380, 350, 300, 240, 220, 190, 165, 150, 140, 125, 115, 100, 92, 85, 78, 70, 64,
  58, 52, 47, 43, 39, 35, 31, 28, 25, 22, 19, 17, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1,
];

const wallOf = (spends: readonly number[]) =>
  spends.map((spend, i) => ({ id: `s${i}`, liveCents: spend * 100 }));

/**
 * The buy panel quotes `shareAfterSpend`, which is `computeShares` with the
 * purchase added. It used to quote `spend / total` clamped to the ceiling.
 * Those disagree once the cap water-fills overflow onto everyone else, and
 * the direction matters: quoting more than the wall delivers is shortchanging
 * a buyer.
 */
describe("the buy panel's promise", () => {
  const wall = wallOf(WALL_SPENDS);

  it("never quotes a bigger share than the wall delivers", () => {
    for (const amount of [100, 1_000, 5_000, 25_000, 100_000]) {
      const quoted = shareAfterSpend(wall, amount);
      const actual =
        computeShares([...wall, { id: "new", liveCents: amount }]).find((s) => s.id === "new")
          ?.share ?? 0;
      expect(actual, `$${amount / 100}`).toBeGreaterThanOrEqual(quoted - 1e-9);
    }
  });

  it("holds on a young wall, where the looser ceiling applies", () => {
    const young = wall.slice(0, 5);
    for (const amount of [100, 10_000, 500_000]) {
      const quoted = shareAfterSpend(young, amount);
      const actual =
        computeShares([...young, { id: "new", liveCents: amount }]).find((s) => s.id === "new")
          ?.share ?? 0;
      expect(actual, `$${amount / 100} on 5 squares`).toBeGreaterThanOrEqual(quoted - 1e-9);
    }
  });
});

/**
 * A ceiling below 1/n cannot be met by n squares, so the wall would not add up.
 * The founding square rendered "60.0%" of a wall it wholly occupied before this
 * was enforced.
 */
describe("the ceiling at launch sizes", () => {
  it("lets the squares fill the wall between them", () => {
    for (let n = 1; n <= 12; n++) {
      expect(ceilingFor(n) * n, `n=${n}`).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });

  it("shares always total the whole wall", () => {
    for (const spends of [[100], [100, 50], [100, 50, 25], [200, 100, 50, 25, 10]]) {
      const total = computeShares(
        spends.map((c, i) => ({ id: `${i}`, liveCents: c * 100 })),
      ).reduce((sum, x) => sum + x.share, 0);
      expect(total, `${spends.length} squares`).toBeCloseTo(1, 6);
    }
  });

  it("gives a lone founding square the whole wall", () => {
    expect(computeShares([{ id: "a", liveCents: 5_000 }])[0]?.share).toBe(1);
  });
});

/**
 * The panel and the wall must print the same number for the same purchase.
 * They did not: the quote was `spend / total` clamped, the wall water-fills the
 * cap across everyone else, and a buyer promised 2.5% was handed 2.6% seconds
 * later. Under-delivering would be worse, but two numbers is still a bug.
 */
describe("the quote equals what the wall renders", () => {
  const rows = wallOf(WALL_SPENDS);

  it("matches exactly for a new square, at every amount", () => {
    for (const amount of [100, 1_000, 7_400, 50_000, 250_000, 2_000_000]) {
      const quoted = shareAfterSpend(rows, amount);
      const delivered =
        computeShares([...rows, { id: "buyer", liveCents: amount }]).find((r) => r.id === "buyer")
          ?.share ?? 0;
      expect(quoted, `$${amount / 100}`).toBeCloseTo(delivered, 12);
    }
  });

  it("matches exactly for a top-up", () => {
    const target = rows[7]!;
    for (const amount of [100, 5_000, 100_000]) {
      const quoted = shareAfterSpend(rows, amount, target.id);
      const delivered =
        computeShares(
          rows.map((r) => (r.id === target.id ? { ...r, liveCents: r.liveCents + amount } : r)),
        ).find((r) => r.id === target.id)?.share ?? 0;
      expect(quoted, `top-up $${amount / 100}`).toBeCloseTo(delivered, 12);
    }
  });

  it("quotes more than spend/total when capped squares overflow onto everyone else", () => {
    const amount = 1_000;
    const live = rows.reduce((sum, row) => sum + row.liveCents, 0);
    const naive = amount / (live + amount);
    const quoted = shareAfterSpend(rows, amount);
    expect(quoted).toBeGreaterThan(naive);
  });

  it("prices a target chip to the share it names", () => {
    for (const targetShare of [0.01, 0.025, 0.05, 0.1]) {
      const cost = centsForShareOf(rows, targetShare);
      expect(cost, `${targetShare * 100}%`).not.toBeNull();
      // Paying the quoted price lands on the named share, never under it.
      expect(shareAfterSpend(rows, cost!), `${targetShare * 100}%`).toBeGreaterThanOrEqual(
        targetShare - 1e-6,
      );
    }
  });

  it("lets a cent off a chip leave the named share, so the quote can move", () => {
    const cost = centsForShareOf(rows, 0.1);
    expect(cost).not.toBeNull();
    expect(formatShare(shareAfterSpend(rows, cost!))).toBe("10.0%");
    expect(formatShare(shareAfterSpend(rows, cost! - 1))).not.toBe("10.0%");
  });

  it("offers no chip for a share the holder already exceeds", () => {
    // rows[0] is the biggest square, pinned at the ceiling.
    expect(centsForShareOf(rows, 0.01, rows[0]!.id)).toBeNull();
  });
});
