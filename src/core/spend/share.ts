import { Big } from "../big";
import { ceilingFor } from "../config";

export interface ShareInput {
  id: string;
  liveCents: number;
}

export interface ShareResult {
  id: string;
  /** Final share of the map, after cap and floor. Sums to 1 across the set. */
  share: number;
  /** Share of live spend before anything was clamped. */
  rawShare: number;
  capped: boolean;
  floored: boolean;
}

export interface ShareOptions {
  maxShare?: number;
  /** Minimum share, derived from the minimum tile area and the map area. */
  minShare?: number;
}

const EPS = new Big("1e-12");

/**
 * Turn live spend into displayable shares: raw share, then the display cap with
 * its overflow water-filled across everyone still under it, then the
 * minimum-size floor funded by everyone with headroom.
 *
 * Ratios are Big.js. The exponential decay that produced `liveCents` is not —
 * Big.pow is integer-only — so IEEE stops at the factor, not at live/total.
 */
export function computeShares(
  entries: readonly ShareInput[],
  options: ShareOptions = {},
): ShareResult[] {
  const n = entries.length;
  if (n === 0) return [];

  const maxShare = new Big(options.maxShare ?? ceilingFor(n));
  const oneOverN = new Big(1).div(n);
  const askedMin = new Big(options.minShare ?? 0);
  const minShare = askedMin.lt(oneOverN) ? askedMin : oneOverN;

  const total = entries.reduce((sum, e) => sum.plus(Math.max(0, e.liveCents)), new Big(0));
  const raw = new Map<string, Big>(
    entries.map((e) => [
      e.id,
      total.gt(0) ? new Big(Math.max(0, e.liveCents)).div(total) : new Big(1).div(n),
    ]),
  );

  const share = new Map<string, Big>();
  const capped = new Set<string>();
  let pool = entries.map((e) => e.id);
  let remaining = new Big(1);

  for (let pass = 0; pass < 8 && pool.length > 0; pass++) {
    const poolRaw = pool.reduce((sum, id) => sum.plus(raw.get(id) ?? 0), new Big(0));
    const scale = poolRaw.gt(0) ? remaining.div(poolRaw) : new Big(0);
    const over = pool.filter((id) => (raw.get(id) ?? new Big(0)).times(scale).gt(maxShare));

    if (over.length === 0) {
      for (const id of pool) {
        share.set(
          id,
          poolRaw.gt(0) ? (raw.get(id) ?? new Big(0)).times(scale) : remaining.div(pool.length),
        );
      }
      pool = [];
      break;
    }

    for (const id of over) {
      share.set(id, maxShare);
      capped.add(id);
      remaining = remaining.minus(maxShare);
    }
    pool = pool.filter((id) => !capped.has(id));
  }
  for (const id of pool) share.set(id, remaining.div(pool.length));

  const floored = new Set<string>();
  if (minShare.gt(0)) {
    for (let pass = 0; pass < 8; pass++) {
      const below = entries
        .map((e) => e.id)
        .filter((id) => (share.get(id) ?? new Big(0)).lt(minShare.minus(EPS)));
      if (below.length === 0) break;

      let deficit = new Big(0);
      for (const id of below) {
        deficit = deficit.plus(minShare.minus(share.get(id) ?? 0));
        share.set(id, minShare);
        floored.add(id);
      }

      const donors = entries
        .map((e) => e.id)
        .filter((id) => !floored.has(id) && (share.get(id) ?? new Big(0)).gt(minShare));
      const headroom = donors.reduce(
        (sum, id) => sum.plus((share.get(id) ?? new Big(0)).minus(minShare)),
        new Big(0),
      );
      if (headroom.lte(0)) break;

      const taken = deficit.lt(headroom) ? deficit : headroom;
      for (const id of donors) {
        const s = share.get(id) ?? new Big(0);
        share.set(id, s.minus(taken.times(s.minus(minShare).div(headroom))));
      }
    }
  }

  return entries.map((e) => ({
    id: e.id,
    share: (share.get(e.id) ?? new Big(0)).toNumber(),
    rawShare: (raw.get(e.id) ?? new Big(0)).toNumber(),
    capped: capped.has(e.id),
    floored: floored.has(e.id),
  }));
}

/** The share a tile of `minArea` occupies on a map of `mapArea` px². */
export function minShareFor(minArea: number, mapArea: number): number {
  if (mapArea <= 0) return 0;
  return new Big(minArea).div(mapArea).toNumber();
}
