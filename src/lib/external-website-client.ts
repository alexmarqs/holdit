import { TAGLINE_MAX_CHARS } from "@holdit/core";
import { type FaviconSize, isFaviconDomain } from "./utils/favicon";

/**
 * Outbound fetches for other people's sites: the description a square shows
 * when the buyer left the field blank, and the mark we proxy so visitors never
 * ask Google for the wall's contents.
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
 * Note the shape of the favicon request: the domain is interpolated into a URL
 * we construct against a host we hardcode. It never becomes a host we connect
 * to, so this cannot be turned into a request-forgery primitive the way reading
 * a caller-supplied page can.
 */

const FAVICON_UPSTREAM = "https://t0.gstatic.com";
const FAVICON_TIMEOUT_MS = 2_500;
const FAVICON_MAX_BYTES = 256 * 1024;

const FAVICON_CACHE_TTL_SECONDS = 604_800; // 1 week

const SITE_TIMEOUT_MS = 3_000;
const SITE_MAX_BYTES = 96 * 1024;

const BLOCKED_HOST =
  /^(localhost$|.*\.local$|.*\.internal$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.0\.0\.0$)/i;

const META = [
  /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
];

const isUrlReadable = (url: URL): boolean => {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return !BLOCKED_HOST.test(url.hostname);
};

const tidy = (raw: string): string | null => {
  const text = raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 12) return null;
  if (text.length <= TAGLINE_MAX_CHARS) return text;

  const clipped = text.slice(0, TAGLINE_MAX_CHARS - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  // Cutting mid-word looks like a bug; cutting mid-sentence looks deliberate.
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).replace(/[,;:.\s]+$/, "")}…`;
};

const toFaviconUpstreamUrl = (domain: string, size: FaviconSize): string => {
  const url = encodeURIComponent(`https://${domain}`);
  return `${FAVICON_UPSTREAM}/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url}&size=${size}`;
};

export interface FaviconResult {
  bytes: Uint8Array;
  contentType: string;
}

async function fetchFavicon(domain: string, size: FaviconSize): Promise<FaviconResult | null> {
  if (!isFaviconDomain(domain)) return null;

  try {
    const response = await fetch(toFaviconUpstreamUrl(domain, size), {
      headers: { accept: "image/*", "user-agent": "holdit.lol/1.0 (+https://holdit.lol)" },
      signal: AbortSignal.timeout(FAVICON_TIMEOUT_MS),
      next: { revalidate: FAVICON_CACHE_TTL_SECONDS },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = await response.arrayBuffer();
    // A handful of bytes is an error page or a 1px spacer, not a mark.
    if (buffer.byteLength < 32 || buffer.byteLength > FAVICON_MAX_BYTES) return null;

    return { bytes: new Uint8Array(buffer), contentType };
  } catch {
    return null;
  }
}

async function scrapeDescription(target: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return null;
  }
  if (!isUrlReadable(url)) return null;

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html",
        // Without this, sites negotiate on our server's IP rather than the
        // buyer's — stripe.com came back in Portuguese, which is not a line
        // anyone chose to put on their square.
        "accept-language": "en-GB,en;q=0.9",
        "user-agent": "holdit.lol/1.0 (+https://holdit.lol)",
      },
      signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return null;
    // A redirect chain can land somewhere the first check would have refused.
    if (!isUrlReadable(new URL(response.url))) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let html = "";
    while (html.length < SITE_MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    await reader.cancel().catch(() => {});

    for (const pattern of META) {
      const found = pattern.exec(html)?.[1];
      const line = found ? tidy(found) : null;
      if (line) return line;
    }
    return null;
  } catch {
    // A square with no line is fine. A failed purchase is not.
    return null;
  }
}

/**
 * The line the site publishes about itself, when the buyer left the field blank.
 *
 * `@handle` targets are skipped: they all resolve to one social host, whose
 * description says nothing about the person. Never a sentence we compose —
 * inventing one and printing it beside a real company's logo reads as their
 * own claim, and it is not.
 */
async function fetchSiteInfo(
  handle: string,
  url: string,
  written: string | null | undefined,
): Promise<string | null> {
  if (written?.trim() || handle.startsWith("@")) return null;
  return scrapeDescription(url);
}

export const externalWebsiteClient = {
  fetchFavicon,
  fetchSiteInfo,
};
