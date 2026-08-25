import { clampSpend, MIN_SPEND_CENTS } from "./amounts";
import { computeShares } from "./share";

/**
 * What a spend actually buys, computed the way the wall computes it.
 *
 * The panel used to quote `spend / total` clamped to the ceiling. That is a
 * closed form, and the wall is not: `computeShares` caps the biggest squares
 * and water-fills their overflow across everyone else, which lifts every
 * uncapped square a little. So the quote came in *under* what was delivered —
 * safe, but a buyer who was promised 2.5% and handed 2.6% has still been shown
 * two different numbers for the same purchase, seconds apart.
 *
 * There is no closed form for the water-fill, and there does not need to be:
 * the caller already holds every standing, so the real function can simply be
 * run with the purchase added.
 */
export interface ProjectionRow {
  id: string;
  liveCents: number;
}

const NEW_SQUARE = "__projected__";

export function shareAfterSpend(
  standings: readonly ProjectionRow[],
  amountCents: number,
  holderId?: string,
): number {
  const rows = standings.map((row) => ({ id: row.id, liveCents: row.liveCents }));
  const existing = holderId === undefined ? undefined : rows.find((row) => row.id === holderId);

  if (existing) existing.liveCents += amountCents;
  else rows.push({ id: NEW_SQUARE, liveCents: amountCents });

  const id = existing?.id ?? NEW_SQUARE;
  return computeShares(rows).find((row) => row.id === id)?.share ?? 0;
}

/**
 * The inverse, by bisection.
 *
 * `shareAfterSpend` is monotonic in the amount but has no algebraic inverse
 * once the cap redistributes, so the target chips solve for it numerically.
 * Forty steps over the spend range settles to well under a cent, and the whole
 * search is pure arithmetic on a few dozen rows.
 */
export function centsForShareOf(
  standings: readonly ProjectionRow[],
  targetShare: number,
  holderId?: string,
): number | null {
  if (targetShare <= 0 || targetShare >= 1) return null;
  /*
   * The smallest spend allowed already overshoots this target, so there is no
   * price that lands on it. Returning the minimum produced a chip reading
   * "1% · $1" that actually handed over 3.3% — which is only ever wrong on a
   * small wall, and a small wall is exactly what launch day looks like.
   */
  if (shareAfterSpend(standings, MIN_SPEND_CENTS, holderId) >= targetShare) return null;

  const liveCents = standings.reduce((sum, row) => sum + row.liveCents, 0);
  const current =
    holderId === undefined ? 0 : (standings.find((row) => row.id === holderId)?.liveCents ?? 0);
  const closed = (targetShare * liveCents - current) / (1 - targetShare);
  const high = Math.max(MIN_SPEND_CENTS, Math.ceil(Math.max(0, closed) * 2));
  if (shareAfterSpend(standings, high, holderId) < targetShare) return null;

  let low = MIN_SPEND_CENTS;
  let top = high;
  for (let step = 0; step < 40; step++) {
    const mid = (low + top) / 2;
    if (shareAfterSpend(standings, mid, holderId) < targetShare) low = mid;
    else top = mid;
  }
  return clampSpend(Math.ceil(top));
}
