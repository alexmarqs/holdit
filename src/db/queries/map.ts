import { buildMapState, type MapState } from "@holdit/core";
import { loadDataset } from "../cache";
import type { Database } from "../client";

export interface MapStateOptions {
  mapArea?: number;
  onlineNow?: number | null;
  now?: number;
}

export async function getMapState(db: Database, options: MapStateOptions = {}): Promise<MapState> {
  const now = options.now ?? Date.now();
  const dataset = await loadDataset(db, now);
  return buildMapState({
    ...dataset,
    now,
    mapArea: options.mapArea,
    onlineNow: options.onlineNow ?? dataset.onlineNow,
  });
}
