import type { Database } from "./client";
import { loadMapDataset, type MapDataset } from "./queries/dataset";

/**
 * Loads the rows the wall is built from. Deliberately holds nothing between
 * requests.
 *
 * An in-process cache here would be per-instance: on serverless the purchase
 * clears the copy belonging to the one machine that handled it, while every
 * other machine keeps serving its own until that expires. Two visitors then see
 * different walls with no way to tell which is right.
 *
 * The CDN is the only cache, so the database stays the single source of truth
 * and every instance answers identically. A cache miss costs one query and some
 * pure arithmetic; `s-maxage` on /api/state is what keeps those rare.
 */
let inflight: Promise<MapDataset> | null = null;

export async function loadDataset(db: Database, now = Date.now()): Promise<MapDataset> {
  // Collapse simultaneous loads within one instance into a single query. This
  // cannot serve a stale copy — the promise is dropped as soon as it settles.
  inflight ??= loadMapDataset(db, now).finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Drops any in-flight load.
 *
 * Only tests need this. The promise outlives a single test file's database, so
 * without it one suite can be answered from a load started against another
 * suite's rows.
 */
export function resetDatasetCache(): void {
  inflight = null;
}
