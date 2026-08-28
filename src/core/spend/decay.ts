import { Big } from "../big";
import { HALF_LIFE_DAYS, MS_PER_DAY } from "../config";
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
 * When live spend is half of what it is at `now`, if nobody buys.
 *
 * Same half-life as every purchase, so a sum of them halves on this instant
 * too.
 */
export function halvesAt(now: number): number {
  return now + HALF_LIFE_DAYS * MS_PER_DAY;
}

/** How much of one purchase still counts towards area. */
export function liveCentsForPurchase(purchase: Faded, now: number): number {
  if (purchase.refundedAt !== null) return 0;
  return new Big(purchase.amountCents).times(decayFactor(now - purchase.createdAt)).toNumber();
}

export function liveCentsForHolder(purchases: readonly Faded[], now: number): number {
  let total = new Big(0);
  for (const p of purchases) total = total.plus(liveCentsForPurchase(p, now));
  return total.toNumber();
}

/** Spend never fades in the record. All-time totals are permanent. */
export function allTimeCents(
  purchases: readonly Pick<Purchase, "amountCents" | "refundedAt">[],
): number {
  let total = 0;
  for (const p of purchases) if (p.refundedAt === null) total += p.amountCents;
  return total;
}
