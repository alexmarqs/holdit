const SKEW_MS = 120_000;
const EARLIEST = Date.UTC(2020, 0, 1);

/**
 * Prints snap to a thirty-second grid.
 *
 * `/api/og?at=` is the costliest route on the site — a full Satori render plus
 * one outbound favicon fetch per square — and `at` is caller-controlled, so
 * every distinct value is a guaranteed CDN miss billed straight to the
 * function. Rounding collapses that: two shares minted in the same thirty
 * seconds draw one image between them, and a flood of random stamps lands in a
 * bounded set of buckets, so the second request onward is a cache hit.
 *
 * Decay runs over days, so a wall rounded down thirty seconds is the same wall.
 * Thirty seconds is also tight enough that a square which just landed still
 * sits on the card — rounding back five minutes could drop it.
 */
const BUCKET_MS = 30_000;

/**
 * The instant a share was printed. Null means "use the live wall".
 *
 * Accepts unix milliseconds or ISO, so a tweet URL stays parseable if a human
 * edits it. Future stamps are refused — that would invent a wall that has not
 * happened.
 */
export function parsePrintAt(
  value: string | string[] | undefined | null,
  now = Date.now(),
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parsed = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  if (parsed > now + SKEW_MS) return null;
  if (parsed < EARLIEST) return null;
  // Down, never up: rounding forward could name an instant that has not
  // happened yet, which is the one thing the skew check exists to refuse.
  return Math.floor(parsed / BUCKET_MS) * BUCKET_MS;
}
