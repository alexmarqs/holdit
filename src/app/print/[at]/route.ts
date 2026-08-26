import { NextResponse } from "next/server";
import { CACHE } from "@/lib/http-cache";
import { parsePrintAt } from "@/lib/utils/print-at";
import { printCardHtml } from "./card";

/**
 * A shared picture of the wall at one instant.
 *
 * `at` is the unix ms on the share URL. Parsed here, then written into the
 * HTML so `og:image` is `/api/og?at=`. That route freezes the wall; this one
 * only serves tags. Those tags are a pure function of `at`, so the CDN can
 * hold them as long as the image (`immutable` for a year). No
 * `stale-while-revalidate`: that is for pages that change.
 *
 * A stamp we cannot read — junk, or still in the future — is `no-store`. A
 * future `/print/{at}` becomes a real card in a few minutes; caching the 302
 * would keep sending unfurlers home after that.
 */
export async function GET(request: Request, context: { params: Promise<{ at: string }> }) {
  const at = parsePrintAt((await context.params).at);

  if (at === null) {
    const bounce = NextResponse.redirect(new URL("/", new URL(request.url)), 302);
    bounce.headers.set("cache-control", CACHE.noStore);
    return bounce;
  }

  return new Response(printCardHtml(at), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, follow",
      "cache-control": CACHE.printHtml,
    },
  });
}
