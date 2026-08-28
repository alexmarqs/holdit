import { describe, expect, it } from "vitest";
import { ceilingFor } from "../config";
import { centsForShareOf, shareAfterSpend } from "./project";
import { computeShares } from "./share";

/**
 * The local sandbox wall this copy was read from: four squares, $10.94 live.
 * A fifth buyer is capped at 32%.
 */
const SANDBOX = [
  { id: "epilot", liveCents: 399 },
  { id: "handle", liveCents: 398 },
  { id: "company", liveCents: 198 },
  { id: "reval", liveCents: 99 },
] as const;

const LIVE = SANDBOX.reduce((sum, row) => sum + row.liveCents, 0);
const WHALE = 250_000;

describe("the hold line on the sandbox wall", () => {
  const ceiling = ceilingFor(SANDBOX.length + 1);

  it("caps a fifth square at 32%, which a few dollars already buy", () => {
    expect(LIVE).toBe(1_094);
    expect(ceiling).toBeCloseTo(0.32, 10);

    const toCap = centsForShareOf(SANDBOX, ceiling);
    expect(toCap).not.toBeNull();
    expect(toCap!).toBeLessThan(1_000);
    expect(shareAfterSpend(SANDBOX, toCap!)).toBeCloseTo(ceiling, 5);
    expect(shareAfterSpend(SANDBOX, WHALE)).toBeCloseTo(ceiling, 10);
  });

  it("spend past the cap is hold: the buyer stays at 32% and nobody else's tile moves", () => {
    const youAtCap = 600;
    const youPastCap = 10_600;
    const cheap = computeShares([...SANDBOX, { id: "you", liveCents: youAtCap }]);
    const extra = computeShares([...SANDBOX, { id: "you", liveCents: youPastCap }]);
    const epilotCheap = cheap.find((row) => row.id === "epilot");
    const epilotExtra = extra.find((row) => row.id === "epilot");

    expect(cheap.find((row) => row.id === "you")?.share).toBeCloseTo(ceiling, 5);
    expect(extra.find((row) => row.id === "you")?.share).toBeCloseTo(ceiling, 5);
    // Water-fill already handed the leftover 68% to everyone else. Dumping
    // more money into the capped square does not change that leftover or the
    // others' relative live, so their display shares are invariant. What falls
    // is raw share — how much of the wall's money they still account for.
    expect(epilotExtra?.share).toBeCloseTo(epilotCheap?.share ?? 0, 10);
    expect(epilotExtra?.rawShare ?? 1).toBeLessThan(epilotCheap?.rawShare ?? 0);
  });
});

/**
 * After the $106 cap6sandbox top-up: five squares, ~$117 live. A sixth
 * square is capped at 26.67%. The buy panel used to quote "$50 keeps 26.67%
 * until others add $20"; the second half of that sentence is gone, because the
 * $20 measured raw share rather than what the wall renders.
 */
const HELD = [
  { id: "cap6", liveCents: 10_598 },
  { id: "epilot", liveCents: 398 },
  { id: "handle", liveCents: 397 },
  { id: "company", liveCents: 198 },
  { id: "reval", liveCents: 99 },
] as const;

describe("a sixth square on a five-square wall", () => {
  const spend = 5_000;
  const ceiling = ceilingFor(HELD.length + 1);

  it("caps a sixth square at 26.67%", () => {
    expect(ceiling).toBeCloseTo(1.6 / 6, 10);
    expect(shareAfterSpend(HELD, spend)).toBeCloseTo(ceiling, 5);
  });
});

/*
 * What the buy panel promises a capped buyer.
 *
 * The panel used to name the wall size at which a capped hold would end. Three
 * real purchases showed that figure measures raw share, not what the wall
 * renders: the overflow of the squares above you lifts you back onto the cap,
 * so the hold outlives the number. Two replacement rules were tried against
 * `computeShares` and both are false — "N other squares must each pass yours"
 * (wrong on 1236 of 1444 random walls, N varies with the wall's shape) and "no
 * single buyer can dislodge you at any price" (wrong on 413 of 1078).
 *
 * What holds is that extra spend defends the cap against the wall growing
 * around you, which is what the terms page always claimed. The two tests below
 * are the boundary of that claim: worthless against one rival, real against the
 * wall.
 */
describe("what money past the cap buys", () => {
  const rivalBoost = 250_000;

  function shareWith(myCents: number): number {
    const rows = [...HELD.map((row) => ({ ...row })), { id: "you", liveCents: myCents }];
    const withRival = rows.map((row) =>
      row.id === "epilot" ? { ...row, liveCents: row.liveCents + rivalBoost } : row,
    );
    return computeShares(withRival).find((row) => row.id === "you")!.share;
  }

  it("never buys a smaller share than paying less would", () => {
    let previous = 0;
    for (const cents of [100, 1_000, 5_000, 25_000, 100_000, 1_000_000]) {
      const share = shareWith(cents);
      expect(share).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = share;
    }
  });

  /*
   * One rival adding money is the case where extra spend looks worthless: its
   * own overflow water-fills back onto you, so a $10 square and a $1,000 square
   * both hold this cap at any single-rival spend. That is what makes "together"
   * load-bearing in the panel copy, and why no single-rival figure belongs in it.
   */
  it("is not what one rival's money decides, at any price", () => {
    expect(shareWith(100_000)).toBeCloseTo(shareWith(1_000), 12);
  });

  /*
   * Spread the same money across the wall instead and the advantage appears. It
   * is the claim the terms page makes — "it helps the square hold the cap as
   * others buy" — and the reason the panel can promise anything at all: across
   * 123 random walls where both spends reached the cap, the larger square
   * survived strictly more rival money 123 times, with no ties.
   */
  it("is how much the wall must grow around you before the cap slips", () => {
    const ceiling = ceilingFor(HELD.length + 1);
    const rivalPotToDislodge = (myCents: number): number => {
      const rows = [...HELD.map((row) => ({ ...row })), { id: "you", liveCents: myCents }];
      const rivals = rows.filter((row) => row.id !== "you");
      const rivalTotal = rivals.reduce((sum, row) => sum + row.liveCents, 0);
      const heldAt = (pot: number) =>
        computeShares(
          rows.map((row) =>
            row.id === "you"
              ? row
              : { ...row, liveCents: row.liveCents + (pot * row.liveCents) / rivalTotal },
          ),
        ).find((row) => row.id === "you")!.share >=
        ceiling - 1e-9;

      let low = 0;
      let high = 100;
      while (heldAt(high) && high < 1e12) high *= 2;
      for (let step = 0; step < 40; step++) {
        const mid = (low + high) / 2;
        if (heldAt(mid)) low = mid;
        else high = mid;
      }
      return low;
    };

    expect(rivalPotToDislodge(100_000)).toBeGreaterThan(rivalPotToDislodge(10_000));
    expect(rivalPotToDislodge(10_000)).toBeGreaterThan(rivalPotToDislodge(5_000));
  });
});
