import { externalWebsiteClient } from "@/lib/external-website-client";
import { CACHE } from "@/lib/http-cache";
import { isFaviconDomain } from "@/lib/utils/favicon";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

/**
 * Same-origin favicon bytes for a wall download.
 *
 * GET, one domain per path, so the CDN key is the square. A POST of the whole
 * wall could never be that: every set of handles was a unique body, and POST
 * is not cached. `s-maxage` is 30 days because logos change about never.
 *
 * The live map still hotlinks Google. html-to-image cannot paint that host
 * (CORP, no ACAO). This route is the same bytes on our origin.
 *
 * Rate limit is sized for one download of a full wall (hundreds of parallel
 * GETs on a cold CDN). After that the edge answers and origin is not hit.
 */
export async function GET(request: Request, context: { params: Promise<{ domain: string }> }) {
  const limited = await rateLimit("favicon", clientIp(request), {
    limit: 200,
    windowSeconds: 60,
  });
  if (!limited.ok) {
    return new Response(null, {
      status: 429,
      headers: { "cache-control": CACHE.noStore },
    });
  }

  const raw = decodeURIComponent((await context.params).domain).toLowerCase();
  if (!isFaviconDomain(raw)) {
    return new Response(null, {
      status: 404,
      headers: { "cache-control": CACHE.faviconInvalidDomain },
    });
  }

  const found = await externalWebsiteClient.fetchFavicon(raw, 128);
  if (!found) {
    return new Response(null, {
      status: 404,
      headers: { "cache-control": CACHE.faviconMiss },
    });
  }

  return new Response(new Uint8Array(found.bytes).buffer, {
    status: 200,
    headers: {
      "content-type": found.contentType,
      "cache-control": CACHE.favicon,
    },
  });
}
