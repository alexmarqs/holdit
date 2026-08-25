/**
 * A square is identified by what it points at. There are no accounts, so this
 * normalisation is the identity function of the whole product — "Linear.app/",
 * "https://www.linear.app" and "linear.app" must all resolve to one square.
 */

import { faviconDomain } from "./favicon";

export interface NormalizedTarget {
  /** Display name on the tile. */
  handle: string;
  /** Where the click redirect sends people. */
  url: string;
}

const HANDLE_RE = /^@([A-Za-z0-9_]{1,30})$/;
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export function normalizeTarget(input: string): NormalizedTarget | null {
  const raw = input.trim();
  if (raw.length === 0) return null;

  const asHandle = HANDLE_RE.exec(raw);
  if (asHandle?.[1]) {
    /*
     * Lowercased for the same reason domains are, one line down. The platform
     * treats usernames case-insensitively, so "@Foo" and "@foo" are one person
     * — but `holders_handle_key` is case-sensitive, so leaving the case as
     * typed let them become two squares pointing at one profile. Worse, it
     * silently turned a top-up into a second purchase: type "@Foo" when your
     * square says "@foo" and you paid to create a new square instead of
     * growing the one you own.
     */
    const name = asHandle[1].toLowerCase();
    return { handle: `@${name}`, url: `https://x.com/${name}` };
  }

  let candidate = raw.toLowerCase().replace(/^https?:\/\//, "");
  candidate = candidate.replace(/^www\./, "");

  const [hostAndPath] = candidate.split(/[?#]/);
  if (!hostAndPath) return null;
  const [host, ...pathParts] = hostAndPath.split("/");
  if (!host || !DOMAIN_RE.test(host)) return null;

  const path = pathParts.join("/").replace(/\/+$/, "");
  return {
    handle: host,
    url: path.length > 0 ? `https://${host}/${path}` : `https://${host}`,
  };
}

export function isValidTarget(input: string): boolean {
  return normalizeTarget(input) !== null;
}

/**
 * Our own endpoint, not Google's directly. See `utils/favicon.ts` for why: the
 * browser should not be handing a third party the contents of the wall, and the
 * upstream host is blocked in places where the wall would then render bare.
 *
 * The handle-to-domain rule is `faviconDomain`, not a copy of it. Two copies of
 * a rule about case are exactly the pair that drifts.
 */
export function faviconUrl(handle: string, size: 32 | 64 | 128 = 64): string {
  return `/api/favicon?domain=${encodeURIComponent(faviconDomain(handle))}&size=${size}`;
}

/** Two letters for the fallback tile when a favicon fails to load. */
export function monogram(handle: string): string {
  const cleaned = handle.replace(/^@/, "");
  return cleaned.slice(0, 2).toUpperCase();
}

/**
 * A short display form for a square too narrow to hold the whole domain.
 *
 * Ellipsising the full handle cuts inside the TLD — "biomejs.d…", "inngest.c…" —
 * which reads as broken text rather than as an abbreviation. The first label is
 * the part people recognise, and the favicon beside it carries the rest.
 */
export function shortHandle(handle: string): string {
  if (handle.startsWith("@")) return handle;
  return handle.split(".")[0] ?? handle;
}
