import { ceilingFor } from "../config";

/**
 * There is no currency to learn. You spend dollars; your square is your dollars
 * as a share of everyone's live dollars.
 */

/**
 * Entry price. Any amount at or above this puts you on the map.
 *
 * Deliberately low, so the map fills from the bottom rather than waiting for
 * large spenders. Worth knowing where the floor really is: a card processor
 * takes roughly 5% + 50c, so at $1 the fee is over half the payment and at $3
 * it is about a fifth. $1 buys reach, not margin.
 */
export const MIN_SPEND_CENTS = 100;

export const MAX_SPEND_CENTS = 2_000_000;

/** What the − and + controls step through. Round numbers people actually pick. */
export const AMOUNT_LADDER_CENTS: readonly number[] = [
  100, 200, 500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
] as const;

export const DEFAULT_AMOUNT_CENTS = 1_000;

/**
 * What the buy panel opens on. An empty wall quotes 100% at any price, so the
 * default $10 would look like a bigger hold than $1 — it is not. Once somebody
 * is on the wall, the usual default is a square you can actually see.
 */
export function openingAmountCents(squaresLive: number): number {
  return squaresLive <= 0 ? MIN_SPEND_CENTS : DEFAULT_AMOUNT_CENTS;
}

export function clampSpend(cents: number): number {
  // Only NaN has no sensible clamp. Infinities must fall to the nearer bound,
  // not to the minimum — an overflowing amount becoming $5 would be a surprise.
  if (Number.isNaN(cents)) return MIN_SPEND_CENTS;
  return Math.min(MAX_SPEND_CENTS, Math.max(MIN_SPEND_CENTS, Math.round(cents)));
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
  const total = liveCents + amountCents;
  if (total <= 0) return 1;
  const raw = (currentCents + amountCents) / total;
  return Math.min(raw, ceilingFor(squareCount + (currentCents > 0 ? 0 : 1)));
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
  // 100% is asymptotic — no finite amount reaches it — so the honest answer at
  // and beyond the asymptote is the ceiling, not the floor.
  if (share >= 1) return MAX_SPEND_CENTS;
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
  const needed = (targetShare * liveCents - currentCents) / (1 - targetShare);
  return needed > 0 ? clampSpend(needed) : null;
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
