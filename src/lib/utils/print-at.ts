export const PRINT_BUCKET_MS = 30_000;

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
 * The URL stamp is the *start* of the bucket. Reconstruction must not use that
 * start: flooring a share posted 15s after a buy would load the wall *before*
 * the buy (`createdAt > at`) and freeze a card that is missing the square.
 * `printWallAt` is the end of the bucket, clamped to now.
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
  return Math.floor(parsed / PRINT_BUCKET_MS) * PRINT_BUCKET_MS;
}

/**
 * Instant to reconstruct the wall for a print URL.
 *
 * The parsed stamp is the bucket start (CDN key). The wall is the bucket's
 * last millisecond, or `now` if that end has not arrived — so a square bought
 * in this window is still `createdAt <=` the reconstruction.
 */
export function printWallAt(bucketStart: number, now = Date.now()): number {
  return Math.min(bucketStart + PRINT_BUCKET_MS - 1, now);
}

/**
 * Whether the bucket has closed, so its wall can no longer change.
 */
export function printBucketClosed(bucketStart: number, now = Date.now()): boolean {
  return bucketStart + PRINT_BUCKET_MS - 1 <= now;
}
