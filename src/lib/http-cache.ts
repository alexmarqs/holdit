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

export const CACHE = {
  noStore,

  /** Print HTML: the browser meta-refreshes away; the CDN holds the tags forever. */
  printHtml: immutable(0, HTTP_CACHE.year),

  /** Frozen wall PNG. One stamp, same pixels. */
  printImage: immutable(HTTP_CACHE.year),

  /** Marketing poster — the card can change. */
  marketingOg: swr(HTTP_CACHE.day, HTTP_CACHE.week),

  /** Routine `/api/state` poll. Refresh uses `?fresh=` and `noStore`. */
  wallState: swr(10, 30),

  /** Download proxy hit. Logos change about never. */
  favicon: swr(FAVICON_DATA_REVALIDATE_SECONDS, HTTP_CACHE.week, HTTP_CACHE.day),

  /** Google had nothing. Do not remember a hole for a month. */
  faviconMiss: edgeOnly(5 * HTTP_CACHE.minute),

  /** Host we would never ask Google for. */
  faviconInvalidDomain: edgeOnly(HTTP_CACHE.day),
} as const;
