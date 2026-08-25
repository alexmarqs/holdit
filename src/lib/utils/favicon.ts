/**
 * Pure handle → domain rules for marks. The fetch lives in `externalWebsiteClient`.
 */

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
