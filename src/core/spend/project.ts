import { Big } from "../big";
import { ceilingFor } from "../config";
import {
  ceilToDollar,
  clampSpend,
  MIN_SPEND_CENTS,
  openingQuotedCents,
} from "./amounts";
import { computeShares, type ShareResult } from "./share";

/**
 * What a spend actually buys, computed the way the wall computes it.
 */
export interface ProjectionRow {
  id: string;
  liveCents: number;
}

const NEW_SQUARE = "__projected__";

function rowsAfterSpend(
  standings: readonly ProjectionRow[],
  amountCents: number,
  holderId?: string,
): { rows: ProjectionRow[]; buyerId: string } {
  const rows = standings.map((row) => ({ id: row.id, liveCents: row.liveCents }));
  const existing = holderId === undefined ? undefined : rows.find((row) => row.id === holderId);

  if (existing) {
    existing.liveCents += amountCents;
    return { rows, buyerId: existing.id };
  }
  rows.push({ id: NEW_SQUARE, liveCents: amountCents });
  return { rows, buyerId: NEW_SQUARE };
}

/** The wall after this spend, so the quote is the same function the tiles use. */
export function projectSpend(
  standings: readonly ProjectionRow[],
  amountCents: number,
  holderId?: string,
): { standings: ShareResult[]; buyerId: string } {
  const { rows, buyerId } = rowsAfterSpend(standings, amountCents, holderId);
  return { standings: computeShares(rows), buyerId };
}

export function shareAfterSpend(
  standings: readonly ProjectionRow[],
  amountCents: number,
  holderId?: string,
): number {
  const after = projectSpend(standings, amountCents, holderId);
  return after.standings.find((row) => row.id === after.buyerId)?.share ?? 0;
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
  const closed = new Big(targetShare)
    .times(liveCents)
    .minus(current)
    .div(new Big(1).minus(targetShare));
  const high = Math.max(MIN_SPEND_CENTS, Math.ceil(Math.max(0, closed.toNumber()) * 2));
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

/**
 * The amount a new square shows on first paint.
 *
 * Shared by the form field and the preview store so server HTML and hydration
 * cannot briefly disagree about the opening quote.
 */
export function openingQuoteForWall(standings: readonly ProjectionRow[]): number {
  const ceiling = ceilingFor(standings.length + 1);
  const ceilingCents = centsForShareOf(standings, ceiling);
  const capSpend = Math.max(
    MIN_SPEND_CENTS,
    ceilingCents === null ? MIN_SPEND_CENTS : ceilToDollar(ceilingCents),
  );
  const liveCents = standings.reduce((sum, row) => sum + row.liveCents, 0);
  return openingQuotedCents(standings.length, capSpend, liveCents);
}
