import { describe, expect, it } from "vitest";
import { holdButtonLabel, holdCapCopy, topUpCopy } from "./buy-copy";

/*
 * This line used to promise when the hold would end: "until others add about
 * $575". Three real purchases showed the figure names the wrong quantity. What
 * ends a capped hold is other squares individually outgrowing yours, and how
 * many of those it takes depends on the whole wall — measured between one and
 * six across random walls, with no closed form in the ceiling. Two candidate
 * rules were tested against `computeShares` and both are false:
 *
 *   "until N other squares each pass yours"  — wrong on 1236 of 1444 walls
 *   "no single buyer can take it at any price" — wrong on 413 of 1078 walls
 *
 * What is true, and is what the terms page already said, is that extra spend
 * defends the cap. Measured across 123 random walls where both a spend and ten
 * times that spend reach the cap, the larger square survived strictly more
 * rival money every single time — 123 of 123, no ties. So the line names that
 * and nothing more: no size, no dollar threshold, just a harder square to push
 * off. `hold-claim.test.ts` holds the property test.
 */
describe("holdCapCopy", () => {
  /*
   * "for now" because the ceiling is `ceilingFor(n)`: it tightens as squares
   * arrive, so a bare "is the cap" quietly promises a number that the next
   * buyer changes without anyone spending against this square.
   */
  it("says extra spend defends the cap rather than growing the square", () => {
    expect(holdCapCopy(10_000, 0.32)).toBe(
      "32.0% is the cap for now. $100 holds it. More buys a longer hold, not a bigger square",
    );
    expect(holdCapCopy(1_000, 1.6 / 6)).toBe(
      "26.67% is the cap for now. $10 holds it. More buys a longer hold, not a bigger square",
    );
  });

  it("keeps the panel free of em dashes", () => {
    expect(holdCapCopy(25_000, 1.6 / 6)).not.toContain("—");
    expect(topUpCopy("figma.com", 0.01, 0.013)).not.toContain("—");
    expect(topUpCopy("figma.com", 0.01, 0.010009)).not.toContain("—");
  });

  it("never promises a dollar figure for when the hold ends", () => {
    const copy = holdCapCopy(25_000, 1.6 / 6);
    expect(copy).not.toMatch(/others add/);
    expect(copy).not.toMatch(/until \$/);
    expect(copy).not.toMatch(/\$0/);
  });
});

/*
 * The button and the line under it both used to name a difference. On a busy
 * wall a $1 top-up is a real purchase whose difference rounds to nothing, and
 * both read as a dead control: "Add +0.00%", "1.0% → 1.0%". Whether a change is
 * worth naming is decided by the rendered string, not by a threshold — the same
 * test `activityLine` makes — because that is what the buyer can actually see.
 */
describe("holdButtonLabel", () => {
  it("offers the share on a square that does not exist yet", () => {
    expect(holdButtonLabel(0.2667, null, false)).toBe("Hold 26.67%");
  });

  it("offers the difference when topping up a square that grows visibly", () => {
    expect(holdButtonLabel(0.013, 0.01, false)).toBe("Add +0.30%");
  });

  it("names where the square lands when the difference is too small to show", () => {
    expect(holdButtonLabel(0.010009, 0.01, false)).toBe("Add to 1.0%");
  });

  it("offers the whole share at the cap, because there is no difference to add", () => {
    expect(holdButtonLabel(0.32, 0.32, true)).toBe("Add 32.0%");
  });
});

describe("topUpCopy", () => {
  it("shows the move when the square visibly grows", () => {
    expect(topUpCopy("figma.com", 0.01, 0.013)).toBe("Topping up figma.com: 1.0% → 1.3%");
  });

  it("says what the money bought when the square does not visibly grow", () => {
    expect(topUpCopy("figma.com", 0.01, 0.010009)).toBe(
      "Topping up figma.com: holds 1.0%. More of other people's money to last through",
    );
  });
});
