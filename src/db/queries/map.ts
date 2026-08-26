import { buildMapState, type MapState } from "@holdit/core";
import type { Database } from "../client";
import { loadMapRows, type MapRows } from "./dataset";

export interface MapStateOptions {
  mapArea?: number;
  onlineNow?: number | null;
  now?: number;
}

let liveInflight: Promise<MapRows> | null = null;
const historicalInflight = new Map<number, Promise<MapRows>>();

/**
 * The wall a visitor sees. Rows from Postgres, then the derived numbers —
 * fading, share, cap — in `buildMapState`.
 *
 * Simultaneous live calls on one instance share one query. A print stamp is
 * keyed by `now` so it cannot steal that query (or lend the live wall a
 * trending window from last Tuesday). Nothing is kept after it settles: an
 * in-process cache would be per-machine on serverless, and two visitors would
 * see different walls. The CDN (`s-maxage` on `/api/state`) is the cache; the
 * database stays the source of truth.
 */
export async function getMapState(db: Database, options: MapStateOptions = {}): Promise<MapState> {
  const stamped = options.now;
  const now = stamped ?? Date.now();
  const rows = await (stamped === undefined ? loadLive(db, now) : loadAt(db, stamped));
  return buildMapState({
    ...rows,
    now,
    mapArea: options.mapArea,
    onlineNow: options.onlineNow ?? rows.onlineNow,
  });
}

function loadLive(db: Database, now: number): Promise<MapRows> {
  liveInflight ??= loadMapRows(db, now).finally(() => {
    liveInflight = null;
  });
  return liveInflight;
}

function loadAt(db: Database, at: number): Promise<MapRows> {
  const pending = historicalInflight.get(at);
  if (pending) return pending;
  const load = loadMapRows(db, at).finally(() => {
    historicalInflight.delete(at);
  });
  historicalInflight.set(at, load);
  return load;
}

/**
 * Drops any in-flight load. Only tests need this: the promise can outlive a
 * suite's truncated database.
 */
export function resetMapRowsCache(): void {
  liveInflight = null;
  historicalInflight.clear();
}
