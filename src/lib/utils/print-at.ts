import { createHmac, timingSafeEqual } from "node:crypto";

const SKEW_MS = 120_000;
const EARLIEST = Date.UTC(2020, 0, 1);
/** How far back a paid print may be minted. Long enough to compose a tweet after checkout. */
const MINT_WINDOW_MS = 30 * 60_000;

/**
 * Prints snap to a five-minute grid.
 *
 * `/api/og?at=` is the costliest route on the site — a full Satori render plus
 * one outbound favicon fetch per square — and `at` is caller-controlled, so
 * every distinct value is a guaranteed CDN miss billed straight to the
 * function. Rounding collapses that: two shares minted in the same five minutes
 * draw one image between them, and a flood of random stamps lands in a bounded
 * set of buckets, so the second request onward is a cache hit.
 *
 * Free, because decay runs over days. A wall rounded down five minutes is the
 * same wall — the grid is far finer than anything it can express.
 *
 * A paid share is the exception. Rounding back can drop the square that just
 * landed off the card. Those URLs carry a proof minted by us, and then `at` is
 * kept exact.
 */
const BUCKET_MS = 300_000;

export interface PrintAtOptions {
  proof?: string | null;
  secret?: string | null;
}

/** HMAC that marks a print as ours, so `/api/og` may skip the five-minute grid. */
export function printAtProof(at: number, secret: string): string {
  return createHmac("sha256", secret).update(`print:${at}`).digest("base64url").slice(0, 22);
}

/**
 * Sign a print that just happened. Refused outside a short window so this is
 * not a way to mint unique OG keys for arbitrary stamps.
 */
export function mintPrintAt(
  at: number,
  now: number,
  secret: string,
): { at: number; proof: string } | null {
  if (!Number.isFinite(at)) return null;
  if (at > now + SKEW_MS) return null;
  if (at < now - MINT_WINDOW_MS) return null;
  if (at < EARLIEST) return null;
  return { at, proof: printAtProof(at, secret) };
}

function proofMatches(at: number, proof: string, secret: string): boolean {
  const expected = printAtProof(at, secret);
  const left = Buffer.from(proof);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

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
  options: PrintAtOptions = {},
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parsed = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  if (parsed > now + SKEW_MS) return null;
  if (parsed < EARLIEST) return null;
  const { proof, secret } = options;
  if (proof && secret && proofMatches(parsed, proof, secret)) return parsed;
  // Down, never up: rounding forward could name an instant that has not
  // happened yet, which is the one thing the skew check exists to refuse.
  return Math.floor(parsed / BUCKET_MS) * BUCKET_MS;
}
