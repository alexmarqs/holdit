import { PRINT_BUCKET_MS } from "./utils/print-at";

/**
 * Cache-Control for every public GET.
 *
 * Frozen URLs (`/print/{at}`, `/api/og?at=`) are `immutable`. Anything that can
 * change uses `stale-while-revalidate`. TTLs live here so a print cannot be one
 * day on the tags and forever on the image.
 */

export const HTTP_CACHE = {
  minute: 60,
  hour: 3_600,
  day: 86_400,
  week: 604_800,
  year: 31_536_000,
} as const;

/**
 * A print bucket in seconds — how long an unsettled print may be held.
 *
 * Derived, not restated. A literal 30 here would be a second copy of the grid
 * in `print-at.ts`, free to drift from it: widen the bucket and this would hold
 * a card past the point its wall could still change.
 */
const PRINT_BUCKET_SECONDS = PRINT_BUCKET_MS / 1000;

/** Origin Data Cache for Google favicon bytes. Same lifetime as the download CDN. */
export const FAVICON_DATA_REVALIDATE_SECONDS = HTTP_CACHE.day * 30;

function publicCache(...directives: string[]): string {
  return ["public", ...directives].join(", ");
}

const noStore = "private, no-store";

const immutable = (maxAge: number, sMaxAge = maxAge) =>
  publicCache(`max-age=${maxAge}`, `s-maxage=${sMaxAge}`, "immutable");

const swr = (sMaxAge: number, staleWhileRevalidate: number, maxAge?: number) =>
  publicCache(
    ...(maxAge === undefined ? [] : [`max-age=${maxAge}`]),
    `s-maxage=${sMaxAge}`,
    `stale-while-revalidate=${staleWhileRevalidate}`,
  );

const edgeOnly = (sMaxAge: number) => publicCache(`s-maxage=${sMaxAge}`);

/** Held by the CDN, never by a private cache. */
const edgeFrozen = (sMaxAge: number) => publicCache("max-age=0", `s-maxage=${sMaxAge}`);

export const CACHE = {
  noStore,

  /**
   * Print HTML: the browser meta-refreshes away, so its copy is disposable;
   * the CDN holds the tags forever, because that is what serves crawlers.
   *
   * Not `immutable`: with `max-age=0` nothing is ever fresh for it to apply
   * to, and a redirect is the last thing to promise a browser it may keep.
   */
  printHtml: edgeFrozen(HTTP_CACHE.year),

  /** Frozen wall PNG. One stamp, same pixels — once the bucket has closed. */
  printImage: immutable(HTTP_CACHE.year),

  /**
   * A print whose bucket is still open. `printWallAt` clamps to `now` there,
   * so the pixels are not settled and `printImage` would be a false promise —
   * this holds it only until the bucket closes, after which the same URL is
   * rendered once more and frozen for real.
   */
  printImagePending: edgeOnly(PRINT_BUCKET_SECONDS),

  /**
   * Routine `/api/state` poll. Refresh uses `?fresh=` and `noStore`.
   *
   * `max-age=0` is explicit because Vercel forwards only `public` downstream —
   * it consumes `s-maxage` itself — and the response carries no `etag` or
   * `last-modified`. Without it a live endpoint reaches browsers and proxies
   * with no stated lifetime and nothing to revalidate against, which leaves
   * reuse to whatever heuristic they apply.
   */
  wallState: swr(10, 30, 0),

  /** Download proxy hit. Logos change about never. */
  favicon: swr(FAVICON_DATA_REVALIDATE_SECONDS, HTTP_CACHE.week, HTTP_CACHE.day),

  /** Google had nothing. Do not remember a hole for a month. */
  faviconMiss: edgeOnly(5 * HTTP_CACHE.minute),

  /** Host we would never ask Google for. */
  faviconInvalidDomain: edgeOnly(HTTP_CACHE.day),
} as const;
