import { TAGLINE_MAX_CHARS } from "@holdit/core";

/**
 * The line a site already uses to describe itself.
 *
 * A square needs a sentence under its name, and there are only three places one
 * can come from: the buyer types it, we invent it, or the site supplies it. We
 * must not invent it — putting words in a real company's mouth beside their own
 * logo is a misrepresentation, whatever the intent. So when a buyer leaves the
 * field blank we read the description the site publishes for exactly this
 * purpose. It is the same text a search engine shows, written by them.
 *
 * A buyer's own line always wins; this is only the fallback.
 */

const TIMEOUT_MS = 3_000;
/** `<head>` arrives first; there is no reason to read a whole page. */
const MAX_BYTES = 96 * 1024;

/**
 * Hosts a request must never reach.
 *
 * The URL comes from whoever is buying, and this fetch runs on our server with
 * our network position — so without this it is a request forgery primitive
 * pointed at anything the host can see, cloud metadata endpoints included.
 */
const BLOCKED_HOST =
  /^(localhost$|.*\.local$|.*\.internal$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.0\.0\.0$)/i;

function readable(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return !BLOCKED_HOST.test(url.hostname);
}

/** Collapse entities and whitespace, then trim on a word so it reads as a line. */
function tidy(raw: string): string | null {
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
}

const META = [
  /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
];

export async function fetchSiteDescription(target: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return null;
  }
  if (!readable(url)) return null;

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
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return null;
    // A redirect chain can land somewhere the first check would have refused.
    if (!readable(new URL(response.url))) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let html = "";
    while (html.length < MAX_BYTES) {
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
