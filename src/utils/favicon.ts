/**
 * Where a square's mark comes from.
 *
 * Fetched by us, not by the visitor's browser, for three reasons.
 *
 * A visitor asking Google directly for each logo tells Google the whole
 * contents of the wall and that this person is looking at it. Nothing about
 * showing a logo requires handing a third party that list.
 *
 * `gstatic.com` is also blocked outright in some countries and by plenty of
 * corporate networks and blocklists — and when it is, the wall renders with no
 * logos at all. That is the largest visual failure this site has, and it is
 * invisible from anywhere it would be noticed in testing.
 *
 * And the share card already fetches marks server-side, so proxying leaves one
 * path instead of two that can disagree.
 *
 * Note the shape of the request: the domain is interpolated into a URL we
 * construct against a host we hardcode. It never becomes a host we connect to,
 * so this cannot be turned into a request-forgery primitive the way reading a
 * caller-supplied page can.
 */

/*
 * `faviconV2` here is the real service. `www.google.com/s2/favicons?domain=…`
 * is a legacy alias that answers 301 and redirects to it, so calling that costs
 * an extra connection and round trip per logo for an identical image.
 */
const UPSTREAM_HOST = "https://t0.gstatic.com";
const TIMEOUT_MS = 2_500;
/** A favicon larger than this is not a favicon. */
const MAX_BYTES = 256 * 1024;
/**
 * A week — the staleness the favicon route already accepts, since it serves
 * stale for `stale-while-revalidate=604800` while it refreshes. A day was the
 * wrong half of that policy to copy: the edge treats its day as "refresh in the
 * background", while a miss here is a blocking upstream fetch in the middle of
 * an image render. Logos change about never, so paying that seven times less
 * often costs nothing anyone can see.
 */
const CACHE_TTL_SECONDS = 604_800;

export const FAVICON_SIZES = [32, 64, 128] as const;
export type FaviconSize = (typeof FAVICON_SIZES)[number];

/** Domains only — a handle has no favicon of its own, so it borrows the host's. */
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export function faviconDomain(handle: string): string {
  return handle.startsWith("@") ? "x.com" : handle.toLowerCase();
}

export function isFaviconDomain(value: string): boolean {
  if (value.length > 253 || !DOMAIN_RE.test(value)) return false;
  /*
   * `127.0.0.1` satisfies the label grammar, and a bare address is never a
   * square's handle. Not a forgery risk — the upstream host is hardcoded and
   * this value only ever travels inside a query string Google reads — but there
   * is no reason to spend a request finding that out. No TLD is all digits.
   */
  return /[a-z]/.test(value.slice(value.lastIndexOf(".") + 1));
}

function upstream(domain: string, size: FaviconSize): string {
  const url = encodeURIComponent(`https://${domain}`);
  return `${UPSTREAM_HOST}/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url}&size=${size}`;
}

export interface FaviconResult {
  bytes: Uint8Array;
  contentType: string;
}

export async function fetchFavicon(
  domain: string,
  size: FaviconSize,
): Promise<FaviconResult | null> {
  if (!isFaviconDomain(domain)) return null;
  try {
    const response = await fetch(upstream(domain, size), {
      headers: { accept: "image/*", "user-agent": "holdit.lol/1.0 (+https://holdit.lol)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      /*
       * Caching is opt-in since Next 16, and without this line the card render
       * was the most expensive thing the app did: one wall is up to
       * `MAX_LOGO_FETCHES` domains, every one of them a fresh request upstream,
       * all fired at once. The sized render behind the download button is a
       * guaranteed CDN miss by construction — its URL carries the viewer's exact
       * canvas and a millisecond stamp — so nothing above absorbed them either.
       *
       * The cache matches on URL, so the requested size lives in the key rather
       * than needing one entry per caller.
       */
      next: { revalidate: CACHE_TTL_SECONDS },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = await response.arrayBuffer();
    // A handful of bytes is an error page or a 1px spacer, not a mark.
    if (buffer.byteLength < 32 || buffer.byteLength > MAX_BYTES) return null;

    return { bytes: new Uint8Array(buffer), contentType };
  } catch {
    return null;
  }
}
