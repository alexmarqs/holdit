import type { MapState } from "@holdit/core";
import { formatAgo } from "./format";

/**
 * After Stripe sends the buyer back, the square is not on the wall yet — the
 * webhook is still landing. The tab asks for a newer wall rather than waiting
 * for Refresh: first look at 400ms (the webhook is rarely faster than that),
 * then every 1.5s. Forty seconds of silence reads as a lost payment, so the
 * wait stops and says so.
 */
export const AWAITING_FIRST_MS = 400;
export const AWAITING_GAP_MS = 1_500;
export const AWAITING_GIVE_UP_MS = 40_000;

/** Checkout returns `/?held=<handle>`. Empty or missing does not start awaiting. */
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
): { handle: string; share: number; purchaseId: string | null } | null {
  const standing = wall.standings.find((s) => s.holder.handle === handle);
  if (!standing) return null;
  return { handle, share: standing.share, purchaseId: standing.lastPurchaseId };
}

export function awaitingTimedOut(startedAt: number, now: number): boolean {
  return now - startedAt > AWAITING_GIVE_UP_MS;
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
