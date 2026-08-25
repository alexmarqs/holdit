import {
  FAVICON_SIZES,
  type FaviconSize,
  fetchFavicon,
  isFaviconDomain,
} from "@holdit/utils/favicon";
import { rateLimit } from "@holdit/utils/rate-limit";
import { clientIp } from "@holdit/utils/request";
import { NextResponse } from "next/server";

/**
 * A day at the edge, a week serving stale while it refreshes. Logos change
 * about never, and a miss costs one small upstream fetch.
 */
const EDGE_TTL_SECONDS = 86_400;
const STALE_WHILE_REVALIDATE_SECONDS = 604_800;

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

  /*
   * Generous, because one wall render asks for one image per square and a
   * visitor may reload — but bounded, because each distinct domain is a cache
   * miss and therefore an upstream fetch someone else is paying for.
   */
  const limited = await rateLimit("favicon", clientIp(request), {
    limit: 300,
    windowSeconds: 60,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many icon requests." }, { status: 429 });
  }

  const found = await fetchFavicon(domain, size);
  const body: BodyInit = found ? new Uint8Array(found.bytes) : new Uint8Array(BLANK);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": found?.contentType ?? "image/gif",
      // Cached either way: a domain with no icon should not be re-asked on
      // every render, and 200-with-blank keeps it out of the browser's error path.
      "cache-control": `public, max-age=3600, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
      "x-favicon": found ? "hit" : "blank",
    },
  });
}
