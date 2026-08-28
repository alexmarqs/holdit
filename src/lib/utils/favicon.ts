/**
 * Pure handle → domain rules for marks, and the URLs that load them.
 *
 * The live wall hotlinks Google (`toFaviconUrl`). A download cannot: that host
 * sends CORP and no CORS, so html-to-image would paint a blank. Download points
 * at `toFaviconProxyUrl` — `GET /api/favicons/{domain}` — same-origin bytes the
 * CDN can hold. OG still fetches Google on the server because ImageResponse
 * needs the bytes in-process.
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

/**
 * Same-origin mark for a download PNG. One path per domain so the CDN key is
 * the square, not "whatever handles were on the wall in this POST".
 */
export function toFaviconProxyUrl(handle: string): string {
  return `/api/favicons/${encodeURIComponent(faviconDomain(handle))}`;
}

/**
 * Google's miss is a 16×16 globe PNG, even when the request asked for 64 or
 * 128. Live `<img>` will still paint a 404 body; download and print must not
 * treat those bytes as a real mark either.
 */
export const FAVICON_PLACEHOLDER_PX = 16;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function pngWidth(bytes: Uint8Array): number | null {
  if (bytes.byteLength < 24) return null;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return null;
  }
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16);
}

/** A decoded width, or PNG bytes, that is Google's placeholder rather than a mark. */
export function isFaviconPlaceholder(source: Uint8Array | number): boolean {
  const width = typeof source === "number" ? source : pngWidth(source);
  if (width === null) return false;
  return width <= FAVICON_PLACEHOLDER_PX;
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
