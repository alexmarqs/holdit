import { NextResponse } from "next/server";
import { parsePrintAt } from "@/lib/utils/print-at";
import { printCardHtml } from "./card";

/**
 * A shared picture of the wall at one instant.
 *
 * Its own path rather than `/?at=`, because reading `searchParams` on the
 * homepage opts that route out of static rendering — one share feature would
 * have cost a full render on every visit to the wall. The cost lands here, on
 * the shared link, instead.
 *
 * A route handler rather than a page: nothing about this URL is for a person or
 * for search — it is `noindex`, and a human is bounced to the live wall — so a
 * whole app document, with its fonts and CSS and RSC payload, was 14KB of
 * scaffolding around eight tags. See `card.ts` for why the page form was also
 * wrong, not merely heavy.
 */
export async function GET(request: Request, context: { params: Promise<{ at: string }> }) {
  const at = parsePrintAt((await context.params).at);

  // A stamp we cannot read has no wall to show. Nothing to unfurl, so nothing to
  // do but send whoever followed it to the live one.
  if (at === null) return NextResponse.redirect(new URL("/", new URL(request.url)), 302);

  return new Response(printCardHtml(at), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      /*
       * The header, not only the meta tag: it applies to the response whether or
       * not anything parses the body.
       */
      "x-robots-tag": "noindex, follow",
      /*
       * The tags for an instant never change, but the code that writes them
       * does, so the CDN may hold this for a day while the browser always asks.
       * Same reasoning as the print image in `/api/og`: nothing about a shared
       * link should be able to stay wrong permanently.
       */
      "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
