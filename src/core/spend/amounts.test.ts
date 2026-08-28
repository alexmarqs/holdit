import { describe, expect, it } from "vitest";
import { ceilingFor } from "../config";
import {
  ceilToDollar,
  centsForShare,
  centsToReachShare,
  clampSpend,
  DEFAULT_AMOUNT_CENTS,
  MAX_SPEND_CENTS,
  MIN_SPEND_CENTS,
  maxTargetShare,
  openingAmountCents,
  openingQuotedCents,
  othersCanAddBeforeSlip,
  projectedShare,
  SHARE_TARGETS,
  stepAmount,
  suggestedHoldCents,
  wallSizeHeldTo,
} from "./amounts";

describe("clampSpend", () => {
  it("does not record below the entry price", () => {
    expect(clampSpend(1)).toBe(MIN_SPEND_CENTS);
    expect(clampSpend(4_321)).toBe(4_321);
  });

  it("survives junk input", () => {
    expect(clampSpend(Number.NaN)).toBe(MIN_SPEND_CENTS);
    expect(clampSpend(Number.POSITIVE_INFINITY)).toBe(MIN_SPEND_CENTS);
    expect(clampSpend(-50)).toBe(MIN_SPEND_CENTS);
  });

  it("does not silently shrink a hold past the last + rung", () => {
    expect(clampSpend(2_000_001)).toBe(2_000_001);
  });
});

describe("MAX_SPEND_CENTS", () => {
  it("is the last + rung on the form, not a charge ceiling", () => {
    expect(MAX_SPEND_CENTS).toBe(1_000_000);
  });
});

describe("ceilToDollar", () => {
  it("raises a chip to the next whole dollar so cents do not tick", () => {
    expect(ceilToDollar(28_951)).toBe(29_000);
    expect(ceilToDollar(2_558)).toBe(2_600);
    expect(ceilToDollar(2_600)).toBe(2_600);
  });
});

describe("stepAmount", () => {
  it("walks up and down the ladder", () => {
    expect(stepAmount(1_000, 1)).toBe(2_000);
    expect(stepAmount(1_000, -1)).toBe(500);
  });

  it("steps from an off-ladder amount to the next rung", () => {
    expect(stepAmount(7_300, 1)).toBe(10_000);
    expect(stepAmount(7_300, -1)).toBe(5_000);
  });

  it("starts low enough that the map can fill from the bottom", () => {
    expect(MIN_SPEND_CENTS).toBeLessThanOrEqual(100);
    expect(stepAmount(MIN_SPEND_CENTS, 1)).toBe(200);
  });

  it("stops at the entry price instead of running off the bottom", () => {
    expect(stepAmount(MIN_SPEND_CENTS, -1)).toBe(MIN_SPEND_CENTS);
  });

  it("starts from a sensible default", () => {
    expect(DEFAULT_AMOUNT_CENTS).toBeGreaterThanOrEqual(MIN_SPEND_CENTS);
  });
});

describe("openingAmountCents", () => {
  it("opens at a dollar on an empty wall, where any spend is 100%", () => {
    expect(openingAmountCents(0)).toBe(MIN_SPEND_CENTS);
  });

  it("keeps the usual default once a square exists", () => {
    expect(openingAmountCents(1)).toBe(DEFAULT_AMOUNT_CENTS);
    expect(openingAmountCents(45)).toBe(DEFAULT_AMOUNT_CENTS);
  });
});

describe("suggestedHoldCents", () => {
  it("quotes about twice what is already live, snapped to a ladder price", () => {
    // ~$11 on the wall → ~$22 → $20. Same wall, more money → a bigger hold.
    expect(suggestedHoldCents(1_095, 600)).toBe(2_000);
    expect(suggestedHoldCents(5_000, 600)).toBe(10_000);
  });

  it("never opens on leftover cap change — at least the next rung above size", () => {
    expect(suggestedHoldCents(0, 600)).toBe(1_000);
  });
});

describe("openingQuotedCents", () => {
  it("opens on the usual default while that amount still grows the square", () => {
    expect(openingQuotedCents(4, 10_000, 50_000)).toBe(DEFAULT_AMOUNT_CENTS);
    expect(openingQuotedCents(0, 600, 0)).toBe(MIN_SPEND_CENTS);
  });

  it("opens on a hold sized to live spend when $10 already hits the cap", () => {
    expect(openingQuotedCents(4, 600, 1_095)).toBe(2_000);
    expect(openingQuotedCents(4, 600, 5_000)).toBe(10_000);
    // The sandbox wall (~$117 live): twice is ~$234 → $250, not $1,000.
    expect(openingQuotedCents(5, 600, 11_691)).toBe(25_000);
  });
});

describe("centsForShare", () => {
  it("inverts projectedShare exactly", () => {
    const live = 65_800;
    for (const share of [0.01, 0.05, 0.1, 0.25, 0.5]) {
      const cents = centsForShare(live, share);
      expect(projectedShare(live, cents)).toBeCloseTo(share, 4);
    }
  });

  it("prices the wall's own defence — the curve is convex", () => {
    const live = 65_800; // a $658 wall
    expect(centsForShare(live, 0.1)).toBe(7_311);
    expect(centsForShare(live, 0.5)).toBe(65_800);
    expect(centsForShare(live, 0.9)).toBe(592_200);
    // Doubling from 25% to 50% costs three times as much as reaching 25% did.
    const quarter = centsForShare(live, 0.25);
    const half = centsForShare(live, 0.5);
    expect(half - quarter).toBeGreaterThan(quarter * 2);
  });

  it("does not invent a finite price for the whole wall", () => {
    expect(centsForShare(65_800, 0)).toBe(MIN_SPEND_CENTS);
    expect(centsForShare(65_800, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(centsForShare(65_800, 0.99999)).toBeGreaterThan(centsForShare(65_800, 0.9));
  });

  it("charges the entry price for the first square on an empty wall", () => {
    expect(centsForShare(0, 0.5)).toBe(MIN_SPEND_CENTS);
  });
});

describe("maxTargetShare", () => {
  it("settles on the display cap once the wall is grown", () => {
    expect(maxTargetShare(15)).toBeCloseTo(0.1, 10);
    expect(maxTargetShare(400)).toBeCloseTo(0.1, 10);
  });

  it("never offers a target above the ceiling the buyer will be held to", () => {
    // Their own square is part of the count, so the ceiling to respect is the
    // one at `count + 1`. Offering the ceiling of the wall they are leaving
    // priced a target that could not render.
    for (const count of [1, 2, 4, 9, 10, 15, 50]) {
      expect(maxTargetShare(count), `n=${count}`).toBeLessThanOrEqual(
        ceilingFor(count + 1) + 1e-12,
      );
    }
  });

  it("is looser but still bounded while the wall is young", () => {
    // With four squares there is no cap, but one buyer should not be able to
    // aim for 90% and leave three slivers.
    const young = maxTargetShare(4);
    expect(young).toBeGreaterThan(0.1);
    expect(young).toBeLessThanOrEqual(0.4);
  });

  it("never offers a target it would refuse to render", () => {
    for (const count of [1, 4, 9, 10, 50]) {
      const limit = maxTargetShare(count);
      for (const target of SHARE_TARGETS.filter((t) => t <= limit)) {
        expect(target).toBeLessThanOrEqual(limit);
      }
    }
  });
});

describe("topping up an existing square", () => {
  // A $658 wall on which this buyer already holds $50.
  const live = 65_800;
  const mine = 5_000;

  it("counts what you already hold towards the result", () => {
    // $50 more is not 7% of the wall — it lands on top of the $50 already there.
    const asNewcomer = projectedShare(live, 5_000);
    const asHolder = projectedShare(live, 5_000, mine);
    expect(asHolder).toBeGreaterThan(asNewcomer);
    expect(asHolder).toBeCloseTo(10_000 / 70_800, 10);
  });

  it("prices a top-up by the gap, not by the whole target", () => {
    const target = 0.2;
    const cost = centsToReachShare(live, mine, target);
    expect(cost).not.toBeNull();
    // Paying it must actually land on the target.
    expect(projectedShare(live, cost!, mine)).toBeCloseTo(target, 4);
    // And it must be cheaper than starting from nothing.
    expect(cost!).toBeLessThan(centsForShare(live, target));
  });

  it("refuses a target at or below what you already hold", () => {
    const held = projectedShare(live, 0, mine); // ~7.6%
    expect(centsToReachShare(live, mine, held)).toBeNull();
    expect(centsToReachShare(live, mine, held / 2)).toBeNull();
    expect(centsToReachShare(live, mine, 0.01)).toBeNull();
  });

  it("still offers a price just above what you hold", () => {
    const held = projectedShare(live, 0, mine);
    const cost = centsToReachShare(live, mine, held + 0.01);
    expect(cost).not.toBeNull();
    expect(cost!).toBeGreaterThan(0);
  });

  it("reduces to the newcomer case when nothing is held", () => {
    for (const target of [0.05, 0.1, 0.25]) {
      expect(centsToReachShare(live, 0, target)).toBe(centsForShare(live, target));
    }
  });
});

/*
 * The buyer is quoted a ceiling and the wall size that holds it, and those two
 * numbers have to come from the same square count — the one that exists *after*
 * the purchase. Reading today's count instead is silent almost everywhere and
 * catastrophic at the two boundaries below, which is exactly why it survived.
 */
describe("the ceiling a buyer is quoted", () => {
  it("is the one that applies after their square exists", () => {
    // The buyer's own square is part of the count, so the ceiling governing them
    // is the one at `n + 1`. It is strictly tighter for every wall still above
    // the display cap, so reading today's count always overstates their room.
    for (let n = 1; n < 16; n++) {
      expect(ceilingFor(n + 1), `n=${n}`).toBeLessThan(ceilingFor(n));
    }
    const spend = 25_000;
    expect(wallSizeHeldTo(spend, ceilingFor(10))).toBeCloseTo(spend / ceilingFor(10), 6);
    expect(wallSizeHeldTo(spend, ceilingFor(9))).not.toBeCloseTo(spend / ceilingFor(10), 6);
  });

  it("tightens without a cliff, so one late square cannot halve a holder", () => {
    /*
     * The two-regime version dropped the ceiling from 60% to 10% the instant a
     * tenth square arrived, so a single dollar could halve the biggest holder.
     *
     * On the `CEILING_BUDGET / n` curve one more square costs at most `1/(n+1)`
     * of the ceiling, which is a third when the wall is three squares — where a
     * third really is what one square is worth — and under a tenth by ten.
     */
    for (let n = 2; n < 40; n++) {
      const drop = ceilingFor(n) - ceilingFor(n + 1);
      expect(drop, `n=${n}`).toBeGreaterThanOrEqual(0);
      expect(drop, `n=${n}`).toBeLessThanOrEqual(ceilingFor(n) / (n + 1) + 1e-12);
    }
    // The step that used to be the cliff.
    expect(ceilingFor(10)).toBeGreaterThan(0.85 * ceilingFor(9));
  });

  it("never quotes an infinite wall to a buyer joining a wall", () => {
    // `ceilingFor(1)` is 100%, and no finite wall reaches a 100% ceiling. A
    // newcomer is never governed by it — their purchase makes the count two —
    // so every count a newcomer can face must produce a finite headroom.
    expect(wallSizeHeldTo(5_000, ceilingFor(1))).toBe(Number.POSITIVE_INFINITY);
    for (let squaresNow = 1; squaresNow <= 40; squaresNow++) {
      expect(wallSizeHeldTo(5_000, ceilingFor(squaresNow + 1))).toBeLessThan(
        Number.POSITIVE_INFINITY,
      );
    }
  });
});

describe("othersCanAddBeforeSlip", () => {
  it("is how much others can pay before a capped square drops under the cap", () => {
    // $100 into a ~$10.95 wall at a 32% cap holds until the wall is $100/0.32.
    const yours = 10_000;
    const wallAfter = 1_095 + 10_000;
    expect(othersCanAddBeforeSlip(yours, wallAfter, 0.32)).toBe(20_100);
  });

  it("is only a couple of dollars when the spend just meets the cap", () => {
    const yours = 600;
    const wallAfter = 1_095 + 600;
    expect(othersCanAddBeforeSlip(yours, wallAfter, 0.32)).toBe(100);
  });

  it("is nothing on a lone square, where the ceiling is the whole wall", () => {
    expect(othersCanAddBeforeSlip(10_000, 10_000, 1)).toBe(0);
  });
});
