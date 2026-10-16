import { clipTagline } from "@holdit/core";
import { FAVICON_DATA_REVALIDATE_SECONDS } from "./http-cache";
import {
  type FaviconSize,
  faviconDomain,
  isFaviconDomain,
  isFaviconPlaceholder,
  toFaviconUrl,
} from "./utils/favicon";

/**
 * Outbound fetches: the tagline scrape at record time, and favicon bytes for
 * OG and `GET /api/favicons/{domain}`. The live wall hotlinks `toFaviconUrl`
 * so those images never touch a Vercel function. This fetches the same URL
 * because ImageResponse and the download proxy need bytes. `force-cache` plus
 * a 30-day `revalidate` is origin Data Cache — two prints of the same square
 * must not pay Google twice. The CDN `s-maxage` on the GET is what skips the
 * function after the first download miss.
 *
 * The favicon request interpolates the domain into a URL against a host we
 * hardcode. It never becomes a host we connect to, so this cannot be turned
 * into a request-forgery primitive the way reading a caller-supplied page can.
 */

const FAVICON_TIMEOUT_MS = 2_500;
const FAVICON_MAX_BYTES = 256 * 1024;

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

/** The named entities worth knowing in a meta description. */
const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  // Last in the object, but order is irrelevant: one pass never rescans its own
  // output, so `&amp;#x27;` decodes to `&#x27;` rather than all the way to `'`.
  amp: "&",
};

/**
 * Decode the entities a scraped description arrives with.
 *
 * This was a hardcoded list of six, which knew the decimal `&#39;` but not the
 * hex `&#x27;` — and hex is what every framework that escapes an apostrophe
 * emits, so a real scrape of anthropic.com put "that&#x27;s" on the wall, in
 * the OG image and in the share copy. Numeric entities are a rule, not a list,
 * so they are decoded as one and only the named ones are enumerated.
 */
export const decodeEntities = (raw: string): string =>
  raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    const token = body.toLowerCase();
    if (token.startsWith("#")) {
      const hex = token.startsWith("#x");
      const code = Number.parseInt(hex ? token.slice(2) : token.slice(1), hex ? 16 : 10);
      if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return match;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[token] ?? match;
  });

const tidy = (raw: string): string | null =>
  clipTagline(decodeEntities(raw).replace(/\s+/g, " ").trim());

export interface FaviconResult {
  bytes: Uint8Array;
  contentType: string;
}

/**
 * Next Data Cache keys on URL, method, headers, and body. A unique
 * `AbortSignal.timeout()` on every call can split that key, so the deadline
 * sits beside the fetch rather than on it. `force-cache` is required in this
 * Next: `revalidate` alone does not opt the request in.
 */
async function fetchCachedFavicon(url: string): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(url, {
        headers: { accept: "image/*", "user-agent": "holdit.lol/1.0 (+https://holdit.lol)" },
        cache: "force-cache",
        next: { revalidate: FAVICON_DATA_REVALIDATE_SECONDS },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new DOMException("The operation timed out.", "TimeoutError")),
          FAVICON_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function fetchFavicon(handle: string, size: FaviconSize): Promise<FaviconResult | null> {
  if (!isFaviconDomain(faviconDomain(handle))) return null;

  try {
    const response = await fetchCachedFavicon(toFaviconUrl(handle, size));

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = await response.arrayBuffer();
    // A handful of bytes is an error page or a 1px spacer, not a mark.
    if (buffer.byteLength < 32 || buffer.byteLength > FAVICON_MAX_BYTES) return null;

    const bytes = new Uint8Array(buffer);
    // Google 404s with a 16px globe that still decodes. Live <img> paints it;
    // a 200 of the same body must not land in download or print either.
    if (isFaviconPlaceholder(bytes)) return null;

    return { bytes, contentType };
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
