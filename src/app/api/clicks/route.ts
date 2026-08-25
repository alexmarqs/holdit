import { db } from "@holdit/db/client";
import { trackClick } from "@holdit/db/queries/clicks";
import { getHolderById } from "@holdit/db/queries/holders";
import { rateLimit } from "@holdit/utils/rate-limit";
import { clientIp, referrerOf } from "@holdit/utils/request";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Only bounded, not a uuid: the mock repository issues ids like `seed-h-1`. */
const Body = z.object({ holderId: z.string().min(1).max(64) });

/**
 * Log an outbound click, beside the hop rather than in front of it.
 *
 * The tile is a plain anchor pointed at the destination, so the browser opens
 * the new tab the instant it is clicked and this beacon flies in parallel.
 * Nothing about our counter sits between a visitor and the site they chose.
 *
 * Deliberately not a /c/{id} redirect: that would put our uptime in front of
 * somebody else's traffic, show a holdit URL on hover instead of theirs, and
 * hand every square an open redirect on our domain.
 *
 * Counts never affect area, so a click we fail to log costs a number and
 * nothing else — which is why every failure here still answers 204.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);

  // One beacon per click. This only stops somebody looping it by hand.
  const limited = await rateLimit("click", ip, { limit: 60, windowSeconds: 60 });
  if (!limited.ok) return new Response(null, { status: 204 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 204 });

  const holder = await getHolderById(db, parsed.data.holderId);
  if (!holder) return new Response(null, { status: 204 });

  try {
    await trackClick(db, {
      holderId: holder.id,
      ip,
      userAgent: request.headers.get("user-agent"),
      referrer: referrerOf(request),
    });
  } catch (error) {
    console.error("Click not logged", error);
  }

  /*
   * 204, with no count in the body. The caller has nothing to do with the
   * answer: per-square click totals already reach every surface through
   * `/api/state`, so the number a tile shows is the polled one either way, and
   * returning it here would only add a count query to every click.
   */
  return new Response(null, { status: 204 });
}

export function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}
