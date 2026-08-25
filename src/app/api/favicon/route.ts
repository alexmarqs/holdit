import { NextResponse } from "next/server";
import { externalWebsiteClient } from "@/lib/external-website-client";
import { FAVICON_SIZES, type FaviconSize, isFaviconDomain } from "@/lib/utils/favicon";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

const BROWSER_TTL_SECONDS = 3_600; // 1 hour
const EDGE_TTL_SECONDS = 86_400; // 1 day
const STALE_WHILE_REVALIDATE_SECONDS = 604_800; // 1 week

/**
 * A 1x1 transparent GIF, so a domain with no favicon is a silent gap rather
 * than a broken-image icon. The client draws its own monogram in that space.
 */
const BLANK = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const domain = (params.get("domain") ?? "").trim().toLowerCase();

  const requested = Number(params.get("size"));

  const size: FaviconSize = (FAVICON_SIZES as readonly number[]).includes(requested)
    ? (requested as FaviconSize)
    : 64;

  if (!isFaviconDomain(domain)) {
    return NextResponse.json({ error: "Not a domain." }, { status: 400 });
  }

  const limited = await rateLimit("favicon", clientIp(request), {
    limit: 300,
    windowSeconds: 60,
  });

  if (!limited.ok) {
    return NextResponse.json({ error: "Too many icon requests." }, { status: 429 });
  }

  const found = await externalWebsiteClient.fetchFavicon(domain, size);
  const body: BodyInit = found ? new Uint8Array(found.bytes) : new Uint8Array(BLANK);

  // - The browser caches for an hour.
  // - The CDN caches for a day.
  // - The server caches for a week while it refreshes.
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": found?.contentType ?? "image/gif",
      "cache-control": `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
      "x-favicon": found ? "hit" : "blank",
    },
  });
}
