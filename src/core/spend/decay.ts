import { HALF_LIFE_DAYS, MS_PER_DAY, OVERFLOW_HALF_LIFE_MULTIPLIER } from "../config";
import type { Purchase } from "../types";

type Faded = Pick<Purchase, "amountCents" | "createdAt" | "refundedAt">;

/**
 * Purchases as they stood at `now` — later buys and later refunds have not
 * happened yet. The print card is this view, frozen.
 */
export function purchasesAsOf<T extends Faded>(purchases: readonly T[], now: number): T[] {
  const asOf: T[] = [];
  for (const purchase of purchases) {
    if (purchase.createdAt > now) continue;
    if (purchase.refundedAt !== null && purchase.refundedAt > now) {
      asOf.push({ ...purchase, refundedAt: null });
    } else {
      asOf.push(purchase);
    }
  }
  return asOf;
}

/** Fraction of an amount still counting after `ageMs`. */
export function decayFactor(ageMs: number, halfLifeDays: number = HALF_LIFE_DAYS): number {
  if (ageMs <= 0) return 1;
  return 0.5 ** (ageMs / (halfLifeDays * MS_PER_DAY));
}

/**
 * How much of one purchase still counts towards area.
 *
 * `capCents` is the largest amount the display cap could ever render. Anything
 * above that line was never going to be shown, so it fades at half rate instead
 * of being wasted — persistence rather than dominance. Pass Infinity to price a
 * purchase without the overflow rule, which is how the first pass finds the map
 * total.
 */
export function liveCentsForPurchase(
  purchase: Faded,
  now: number,
  capCents = Number.POSITIVE_INFINITY,
): number {
  if (purchase.refundedAt !== null) return 0;
  const age = now - purchase.createdAt;
  const withinCap = Math.min(purchase.amountCents, capCents);
  const overflow = Math.max(0, purchase.amountCents - capCents);
  return (
    withinCap * decayFactor(age) +
    overflow * decayFactor(age, HALF_LIFE_DAYS * OVERFLOW_HALF_LIFE_MULTIPLIER)
  );
}

export function liveCentsForHolder(
  purchases: readonly Faded[],
  now: number,
  capCents = Number.POSITIVE_INFINITY,
): number {
  let total = 0;
  for (const p of purchases) total += liveCentsForPurchase(p, now, capCents);
  return total;
}

/** Spend never fades in the record. All-time totals are permanent. */
export function allTimeCents(
  purchases: readonly Pick<Purchase, "amountCents" | "refundedAt">[],
): number {
  let total = 0;
  for (const p of purchases) if (p.refundedAt === null) total += p.amountCents;
  return total;
}
