import type { MapState } from "@holdit/core";
import { QueryClient } from "@tanstack/react-query";

export const WALL_QUERY_KEY = ["wall"] as const;

/**
 * Seed the prerendered wall so the first paint does not fetch.
 */
export function createWallQueryClient(initialState: MapState): QueryClient {
  const client = new QueryClient();
  writeWallCache(client, initialState);
  return client;
}

/** Write one wall into the query cache. */
export function writeWallCache(client: QueryClient, wall: MapState): void {
  client.setQueryData(WALL_QUERY_KEY, wall);
}
