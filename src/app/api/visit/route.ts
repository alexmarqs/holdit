import { db } from "@holdit/db/client";
import { recordVisit } from "@holdit/db/queries/visits";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

/**
 * Count a visitor, from the browser rather than from the render.
 *
 * It used to happen inside the page component, which read `headers()` and so
 * forced the whole route to be rendered per request. That is a heavy price for
 * a counter: every view cost a full render plus the wall's queries, on a page
 * whose HTML is identical for everybody.
 *
 * Moving it here is also more accurate. A prerendered page would have counted a
 * visit only when it revalidated — the figure would have flatlined while still
 * looking like it worked, which is the worst way for a number to be wrong.
 *
 * Not in middleware: that runs for every asset and prefetch, turning one visit
 * into several.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);

  // A page load is one beacon. This only stops somebody looping it.
  const limited = await rateLimit("visit", ip, { limit: 30, windowSeconds: 60 });

  if (!limited.ok) return new Response(null, { status: 204 });

  await recordVisit(db, { ip, userAgent: request.headers.get("user-agent") });

  // 204 always: the caller is a fire-and-forget beacon with nothing to do with
  // the answer, and a failed count must never look like a failed page.
  return new Response(null, { status: 204 });
}
