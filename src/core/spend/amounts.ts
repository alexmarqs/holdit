import { Big } from "../big";
import { ceilingFor } from "../config";

/**
 * Entry price. Any amount at or above this puts you on the map.
 */
export const MIN_SPEND_CENTS = 100; // $1 is the minimum spend

export const AMOUNT_LADDER_CENTS: readonly number[] = [
  100, 200, 500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
] as const;

export const DEFAULT_AMOUNT_CENTS = 1_000;

/** Last + rung on the buy field. Checkout does not silently shrink a larger amount. */
export const MAX_SPEND_CENTS = AMOUNT_LADDER_CENTS[AMOUNT_LADDER_CENTS.length - 1]!;

/**
 * What the buy panel opens on. An empty wall quotes 100% at any price, so the
 * default $10 would look like a bigger hold than $1 — it is not. Once somebody
 * is on the wall, the usual default is a square you can actually see.
 */
export function openingAmountCents(squaresLive: number): number {
  return squaresLive <= 0 ? MIN_SPEND_CENTS : DEFAULT_AMOUNT_CENTS;
}

/**
 * How much hold to quote relative to money already on the wall.
 * $10 on an $11 wall is the next buy; twice live is a stay.
 */
const HOLD_VS_LIVE = 2;

/**
 * A hold sized to the live wall, snapped to a price people tap.
 * Grows as others add money. Never the leftover dollars that just hit the cap.
 */
export function suggestedHoldCents(liveCents: number, capSpendCents: number): number {
  const live = Math.max(0, liveCents);
  const cap = Math.max(MIN_SPEND_CENTS, capSpendCents);
  const snapped = nearestLadderCents(HOLD_VS_LIVE * live);
  const aboveCap = stepAmount(cap, 1);
  return Math.max(snapped, aboveCap);
}

function nearestLadderCents(cents: number): number {
  const target = clampSpend(cents);
  let best = AMOUNT_LADDER_CENTS[0]!;
  for (const step of AMOUNT_LADDER_CENTS) {
    const closer = Math.abs(step - target) < Math.abs(best - target);
    const tieHigher = Math.abs(step - target) === Math.abs(best - target) && step > best;
    if (closer || tieHigher) best = step;
  }
  return best;
}

/**
 * What the buy field should show on first paint.
 *
 * The usual default is $10, a square you can see. If $10 already hits the cap,
 * size is sold out — opening there looks like leftover change. Quote twice
 * live spend so the first number is a stay, not ten walls of money.
 */
export function openingQuotedCents(
  squaresLive: number,
  capSpendCents: number,
  liveCents: number,
): number {
  const usual = openingAmountCents(squaresLive);
  const cap = Math.max(MIN_SPEND_CENTS, capSpendCents);
  if (usual <= cap) return usual;
  return suggestedHoldCents(liveCents, cap);
}

export function clampSpend(cents: number): number {
  if (!Number.isFinite(cents)) return MIN_SPEND_CENTS;
  return Math.max(MIN_SPEND_CENTS, Math.round(cents));
}

/** Aim chips round up to a dollar so quiet decay does not look like a glitch. */
export function ceilToDollar(cents: number): number {
  return clampSpend(Math.ceil(cents / 100) * 100);
}

/** Next rung up or down the ladder from an arbitrary amount. */
export function stepAmount(cents: number, direction: 1 | -1): number {
  const current = clampSpend(cents);
  if (direction === 1) {
    return clampSpend(AMOUNT_LADDER_CENTS.find((step) => step > current) ?? current * 2);
  }
  const lower = [...AMOUNT_LADDER_CENTS].reverse().find((step) => step < current);
  return clampSpend(lower ?? MIN_SPEND_CENTS);
}

/**
 * The share this spend would hold on a wall whose live spend is `liveCents`.
 *
 * `currentCents` is what the buyer already holds, and it is already part of
 * `liveCents` — topping up adds to your own square rather than starting a new
 * one, so the result is `(current + amount) / (live + amount)`. A new buyer
 * passes 0 and gets the simple case.
 */

/**
 * The closed-form share a spend buys, clamped to the ceiling.
 *
 * The panel does not use this — it runs the wall's own model through
 * `shareAfterSpend`, which is exact. This stays because it is the algebraic
 * partner of `centsToReachShare`: the two invert each other, and the ceiling
 * maths below is built on that pair.
 */
export function projectedShare(
  liveCents: number,
  amountCents: number,
  currentCents = 0,
  squareCount = 0,
): number {
  const total = new Big(liveCents).plus(amountCents);
  if (total.lte(0)) return 1;
  const raw = new Big(currentCents).plus(amountCents).div(total);
  const cap = new Big(ceilingFor(squareCount + (currentCents > 0 ? 0 : 1)));
  return (raw.lt(cap) ? raw : cap).toNumber();
}

/**
 * The inverse: what it costs to hold `share` of the wall right now.
 *
 * `share = amount / (live + amount)`, so `amount = live · share / (1 - share)`.
 *
 * This curve is why aiming for a share cannot swallow the wall. It is convex and
 * asymptotic at 100%: on a $658 wall, 10% costs $73, 50% costs $658, and 90%
 * costs $5,922. Nobody is priced out of entering, and nobody buys the whole
 * thing cheaply — the arithmetic does the defending, not a rule.
 */
export function centsForShare(liveCents: number, share: number): number {
  // 100% is asymptotic — no finite amount reaches it.
  if (share >= 1) return Number.POSITIVE_INFINITY;
  return centsToReachShare(liveCents, 0, share) ?? MIN_SPEND_CENTS;
}

/**
 * What it costs to reach `share`, given what the buyer already holds.
 *
 * Solving `(current + amount) / (live + amount) = target` gives
 * `amount = (target · live − current) / (1 − target)`.
 *
 * Returns null when the target is already met or exceeded. Buying can only ever
 * grow a square — there is no way to spend your way to a *smaller* share — so a
 * target at or below what you hold is not a price, it is a no-op, and offering
 * one would be a lie.
 */
export function centsToReachShare(
  liveCents: number,
  currentCents: number,
  targetShare: number,
): number | null {
  if (targetShare <= 0 || targetShare >= 1) return null;
  if (liveCents <= 0) return MIN_SPEND_CENTS;
  const needed = new Big(targetShare)
    .times(liveCents)
    .minus(currentCents)
    .div(new Big(1).minus(targetShare));
  return needed.gt(0) ? clampSpend(needed.toNumber()) : null;
}

/**
 * Letting one buyer aim at 90% of a four-square wall for pocket change would
 * leave three slivers and nothing worth looking at, so aiming stops here however
 * loose the ceiling is on a young wall.
 */
const AIM_CEILING = 0.4;

/**
 * The largest share a buyer may aim for.
 *
 * The ceiling that will govern them — their own square is part of the count, so
 * it is `squareCount + 1` — since a target above it cannot render and offering
 * one would be a lie. Held below `AIM_CEILING` besides, while the wall is young
 * enough for the ceiling to sit above it.
 */
export function maxTargetShare(squareCount: number): number {
  return Math.min(ceilingFor(squareCount + 1), AIM_CEILING);
}

/** Round share targets offered as one-tap chips, filtered by `maxTargetShare`. */
export const SHARE_TARGETS: readonly number[] = [0.01, 0.025, 0.05, 0.1, 0.25, 0.4] as const;

/**
 * How big the wall can get before a spend stops holding the ceiling.
 *
 * This is what money past the ceiling actually buys, and it is worth stating as
 * a number. Once you are capped, more spend cannot make your square bigger —
 * "$359 and $5,000 both show 10%" is a fair thing for a buyer to be suspicious
 * about. What the extra buys is *headroom*: your share only slips when the wall
 * outgrows you, and it outgrows a bigger holder much later.
 *
 * Your share is `spend / total`, so it meets the ceiling exactly when the total
 * reaches `spend / ceiling`. Conservative, too: spend above the ceiling fades at
 * half rate, so in practice it holds a little longer than this says.
 */
export function wallSizeHeldTo(amountCents: number, ceiling: number): number {
  if (ceiling <= 0 || ceiling >= 1) return Number.POSITIVE_INFINITY;
  return amountCents / ceiling;
}

/**
 * How much other people can still pay before this spend drops under the cap.
 *
 * Rounded down to a whole dollar so the buy panel never names an amount
 * that has already slipped under the cap.
 */
export function othersCanAddBeforeSlip(
  yourCentsAfter: number,
  wallCentsAfter: number,
  ceiling: number,
): number {
  const heldTo = wallSizeHeldTo(yourCentsAfter, ceiling);
  if (!Number.isFinite(heldTo)) return 0;
  return Math.max(0, Math.floor((heldTo - wallCentsAfter) / 100) * 100);
}
