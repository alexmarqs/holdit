import type { MapState } from "@holdit/core";
import { QueryClient } from "@tanstack/react-query";
import { formatAgo } from "@/lib/utils/format";

export const WALL_QUERY_KEY = ["wall"] as const;

export const CHASE_FIRST_MS = 400;
export const CHASE_GAP_MS = 1_500;
export const CHASE_GIVE_UP_MS = 40_000;

export function createWallQueryClient(initialState: MapState): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: false,
      },
      mutations: { retry: false },
    },
  });
  writeWallCache(client, initialState);
  return client;
}

/** Write the wall to the query cache.
 *
 * TODO: Alternative: use useQuery with initialData or hydration.
 *
 */
export function writeWallCache(client: QueryClient, wall: MapState): void {
  client.setQueryData(WALL_QUERY_KEY, wall);
}

export function wallStateUrl(fresh: boolean, now = Date.now()): string {
  return fresh ? `/api/state?fresh=${now}` : "/api/state";
}

export async function fetchWall(fresh = false): Promise<MapState> {
  const response = await fetch(wallStateUrl(fresh), fresh ? { cache: "no-store" } : undefined);
  if (!response.ok) throw new Error(`Wall unavailable (${response.status})`);
  return response.json();
}

/**
 * Refresh and chase: a 429 or a dead origin must not replace the wall or
 * surface an error. The rate limit on `/api/state` is 10 / 10s; pressing
 * through it just keeps what they already have.
 */
export async function tryFetchWall(fresh = false): Promise<MapState | null> {
  try {
    return await fetchWall(fresh);
  } catch {
    return null;
  }
}

/** Checkout returns `/?held=<handle>`. Empty or missing is not a chase. */
export function heldHandleFromHref(href: string): string | null {
  const held = new URL(href).searchParams.get("held")?.trim() ?? "";
  return held.length > 0 ? held : null;
}

/** Drop `held` so a reload does not start watching for somebody else's square. */
export function hrefWithoutHeld(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("held");
  return url.pathname + url.search + url.hash;
}

export function claimedSquare(
  wall: MapState,
  handle: string,
): { handle: string; share: number } | null {
  const standing = wall.standings.find((s) => s.holder.handle === handle);
  if (!standing) return null;
  return { handle, share: standing.share };
}

export function chaseTimedOut(startedAt: number, now: number): boolean {
  return now - startedAt > CHASE_GIVE_UP_MS;
}

/**
 * How long a tab can sit on a wall before we mention Refresh.
 *
 * Shorter than this and the hint would fire on a routine look — ISR is 30s,
 * the edge copy is 10s. Two minutes is "you walked away", not "the CDN is 10s
 * old".
 */
export const WALL_STALE_HINT_MS = 120_000;

/**
 * When the age next to Refresh warms up from muted to orange.
 *
 * Two minutes is a caption. Fifteen is "you went to make coffee" on a live
 * product page. Red stays for errors — a sitting tab is not one.
 */
export const WALL_STALE_WARN_MS = 15 * 60_000;

/** Compact age for the Refresh control, or null while the snapshot is still fresh. */
export function wallStaleAgo(generatedAt: number, now: number): string | null {
  if (now - generatedAt < WALL_STALE_HINT_MS) return null;
  return formatAgo(generatedAt, now);
}

export function wallStaleWarn(generatedAt: number, now: number): boolean {
  return now - generatedAt >= WALL_STALE_WARN_MS;
}
