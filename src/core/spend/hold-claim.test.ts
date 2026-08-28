import { describe, expect, it } from "vitest";
import { ceilingFor } from "../config";
import { othersCanAddBeforeSlip } from "./amounts";
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

  it("still has raw 32% after others add the quoted dollars, and slips one dollar later", () => {
    const wallAfter = LIVE + WHALE;
    const quoted = othersCanAddBeforeSlip(WHALE, wallAfter, ceiling);
    const total = (extra: number) => LIVE + WHALE + extra;

    expect(WHALE / total(quoted)).toBeGreaterThanOrEqual(ceiling);
    expect(WHALE / total(quoted + 100)).toBeLessThan(ceiling);
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
 * square is capped at 26.67%. The buy panel quoted "$50 keeps 26.67% until
 * others add $20".
 */
const HELD = [
  { id: "cap6", liveCents: 10_598 },
  { id: "epilot", liveCents: 398 },
  { id: "handle", liveCents: 397 },
  { id: "company", liveCents: 198 },
  { id: "reval", liveCents: 99 },
] as const;

const HELD_LIVE = HELD.reduce((sum, row) => sum + row.liveCents, 0);

describe("the $50 / $20 quote on a five-square wall", () => {
  const spend = 5_000;
  const ceiling = ceilingFor(HELD.length + 1);
  const wallAfter = HELD_LIVE + spend;
  const quoted = othersCanAddBeforeSlip(spend, wallAfter, ceiling);

  it("caps a sixth square at 26.67%", () => {
    expect(ceiling).toBeCloseTo(1.6 / 6, 10);
    expect(shareAfterSpend(HELD, spend)).toBeCloseTo(ceiling, 5);
  });

  it("the $20 is when raw spend falls under the cap — the tile lasts longer", () => {
    expect(quoted).toBe(2_000);

    const total = (extra: number) => wallAfter + extra;
    expect(spend / total(quoted)).toBeGreaterThanOrEqual(ceiling);
    expect(spend / total(quoted + 100)).toBeLessThan(ceiling);

    const withYou = [...HELD.map((row) => ({ ...row })), { id: "you", liveCents: spend }];
    const addToUncapped = (extra: number) =>
      computeShares(
        withYou.map((row) =>
          row.id === "epilot" ? { ...row, liveCents: row.liveCents + extra } : row,
        ),
      );

    // Water-fill from the $106 square still lifts the $50 square to 26.67%
    // after raw has already slipped. The quote never overstates; it can
    // understate how long the tile actually holds.
    expect(addToUncapped(quoted).find((row) => row.id === "you")?.share).toBeCloseTo(
      ceiling,
      5,
    );
    expect(addToUncapped(quoted + 100).find((row) => row.id === "you")?.share).toBeCloseTo(
      ceiling,
      5,
    );
  });
});
