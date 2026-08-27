import { buildMapState, type MapState } from "@holdit/core";
import type { Database } from "../client";
import { loadMapRows, type MapRows } from "./dataset";

export interface MapStateOptions {
  mapArea?: number;
  onlineNow?: number | null;
  now?: number;
}

let liveCacheData: Promise<MapRows> | null = null;
const historicalCacheData = new Map<number, Promise<MapRows>>();

/**
 * The wall a visitor sees. Rows from Postgres, then the derived numbers —
 * fading, share, cap — in `buildMapState`.
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
  liveCacheData ??= loadMapRows(db, now).finally(() => {
    liveCacheData = null;
  });
  return liveCacheData;
}

function loadAt(db: Database, at: number): Promise<MapRows> {
  const pending = historicalCacheData.get(at);
  if (pending) return pending;
  const load = loadMapRows(db, at, { includeOnline: false }).finally(() => {
    historicalCacheData.delete(at);
  });
  historicalCacheData.set(at, load);
  return load;
}

/**
 * Drops any in-flight load. Only tests need this: the promise can outlive a
 * suite's truncated database.
 */
export function resetMapRowsCache(): void {
  liveCacheData = null;
  historicalCacheData.clear();
}
