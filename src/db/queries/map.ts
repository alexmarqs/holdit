import { buildMapState, type MapState } from "@holdit/core";
import type { Database } from "../client";
import { loadMapRows, type MapRows } from "./dataset";

export interface MapStateOptions {
  mapArea?: number;
  onlineNow?: number | null;
  now?: number;
}

let inflight: Promise<MapRows> | null = null;

/**
 * The wall a visitor sees. Rows from Postgres, then the derived numbers —
 * fading, share, cap — in `buildMapState`.
 *
 * Simultaneous calls on one instance share one query. Nothing is kept after it
 * settles: an in-process cache would be per-machine on serverless, and two
 * visitors would see different walls. The CDN (`s-maxage` on `/api/state`) is
 * the cache; the database stays the source of truth.
 */
export async function getMapState(db: Database, options: MapStateOptions = {}): Promise<MapState> {
  const now = options.now ?? Date.now();
  inflight ??= loadMapRows(db, now).finally(() => {
    inflight = null;
  });
  const rows = await inflight;
  return buildMapState({
    ...rows,
    now,
    mapArea: options.mapArea,
    onlineNow: options.onlineNow ?? rows.onlineNow,
  });
}

/**
 * Drops any in-flight load. Only tests need this: the promise can outlive a
 * suite's truncated database.
 */
export function resetMapRowsCache(): void {
  inflight = null;
}
