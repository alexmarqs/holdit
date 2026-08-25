/**
 * Pure handle → domain rules for marks, and the Google URL the browser loads.
 *
 * The live wall hotlinks this. OG still fetches the same URL on the server
 * (`externalWebsiteClient.fetchFavicon`) because ImageResponse needs bytes.
 *
 * `faviconV2` is the real service. `www.google.com/s2/favicons?domain=…` 301s
 * here, so calling s2 would add a hop for an identical image.
 */

export const FAVICON_SIZES = [32, 64, 128] as const;
export type FaviconSize = (typeof FAVICON_SIZES)[number];

const FAVICON_UPSTREAM = "https://t0.gstatic.com";

export function faviconUpstreamUrl(domain: string, size: FaviconSize): string {
  const url = encodeURIComponent(`https://${domain}`);
  return `${FAVICON_UPSTREAM}/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url}&size=${size}`;
}

/** Domains only — a handle has no favicon of its own, so it borrows the host's. */
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export function faviconDomain(handle: string): string {
  return handle.startsWith("@") ? "x.com" : handle.toLowerCase();
}

/** The URL the live wall hotlinks, and OG fetches. Same string either way. */
export function toFaviconUrl(handle: string, size: FaviconSize = 64): string {
  return faviconUpstreamUrl(faviconDomain(handle), size);
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
