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

/**
 * Turn live spend into displayable shares: raw share, then the display cap with
 * its overflow water-filled across everyone still under it, then the
 * minimum-size floor funded by everyone with headroom.
 *
 * Below ten squares the 10% cap cannot be met — nine squares would leave a
 * tenth of the wall empty — so a looser ceiling applies instead of none. A big
 * spender still dominates a young wall; they just cannot erase it.
 */
export function computeShares(
  entries: readonly ShareInput[],
  options: ShareOptions = {},
): ShareResult[] {
  const n = entries.length;
  if (n === 0) return [];

  // Below ten squares the 10% cap is unsatisfiable, so a looser ceiling applies
  // rather than none at all. It only bites on a square trying to exceed it —
  // everyone under it keeps their exact proportions.
  // An explicit maxShare is the caller overriding the wall's rule (the treemap
  // passes 1 to disable capping on already-capped weights); otherwise the
  // ceiling is whatever n makes satisfiable.
  const maxShare = options.maxShare ?? ceilingFor(n);
  const minShare = Math.min(options.minShare ?? 0, 1 / n);

  const total = entries.reduce((sum, e) => sum + Math.max(0, e.liveCents), 0);
  const raw = new Map<string, number>(
    entries.map((e) => [e.id, total > 0 ? Math.max(0, e.liveCents) / total : 1 / n]),
  );

  const share = new Map<string, number>();
  const capped = new Set<string>();
  let pool = entries.map((e) => e.id);
  let remaining = 1;

  for (let pass = 0; pass < 8 && pool.length > 0; pass++) {
    const poolRaw = pool.reduce((sum, id) => sum + (raw.get(id) ?? 0), 0);
    const scale = poolRaw > 0 ? remaining / poolRaw : 0;
    const over = pool.filter((id) => (raw.get(id) ?? 0) * scale > maxShare);

    if (over.length === 0) {
      for (const id of pool) {
        share.set(id, poolRaw > 0 ? (raw.get(id) ?? 0) * scale : remaining / pool.length);
      }
      pool = [];
      break;
    }

    for (const id of over) {
      share.set(id, maxShare);
      capped.add(id);
      remaining -= maxShare;
    }
    pool = pool.filter((id) => !capped.has(id));
  }
  for (const id of pool) share.set(id, remaining / pool.length);

  const floored = new Set<string>();
  if (minShare > 0) {
    for (let pass = 0; pass < 8; pass++) {
      const below = entries
        .map((e) => e.id)
        .filter((id) => (share.get(id) ?? 0) < minShare - 1e-12);
      if (below.length === 0) break;

      let deficit = 0;
      for (const id of below) {
        deficit += minShare - (share.get(id) ?? 0);
        share.set(id, minShare);
        floored.add(id);
      }

      const donors = entries
        .map((e) => e.id)
        .filter((id) => !floored.has(id) && (share.get(id) ?? 0) > minShare);
      const headroom = donors.reduce((sum, id) => sum + ((share.get(id) ?? 0) - minShare), 0);
      if (headroom <= 0) break;

      const taken = Math.min(deficit, headroom);
      for (const id of donors) {
        const s = share.get(id) ?? 0;
        share.set(id, s - taken * ((s - minShare) / headroom));
      }
    }
  }

  return entries.map((e) => ({
    id: e.id,
    share: share.get(e.id) ?? 0,
    rawShare: raw.get(e.id) ?? 0,
    capped: capped.has(e.id),
    floored: floored.has(e.id),
  }));
}

/** The share a tile of `minArea` occupies on a map of `mapArea` px². */
export function minShareFor(minArea: number, mapArea: number): number {
  if (mapArea <= 0) return 0;
  return minArea / mapArea;
}
