import { db } from "@holdit/db/client";
import { trackClick } from "@holdit/db/queries/clicks";
import { getHolderById } from "@holdit/db/queries/holders";
import { z } from "zod";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp, referrerOf } from "@/lib/utils/request";

const LogClickRequest = z.object({ holderId: z.string().min(1).max(64) });

/**
 * Log an outbound click, beside the hop rather than in front of it.

 */
export async function POST(request: Request) {
  const ip = clientIp(request);

  // One beacon per click. This only stops somebody looping it by hand.
  const limited = await rateLimit("click", ip, { limit: 60, windowSeconds: 60 });
  if (!limited.ok) return new Response(null, { status: 204 });

  const parsed = LogClickRequest.safeParse(await request.json().catch(() => null));

  // A click we cannot read has no holder to click, so nothing to do but log it.
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

  return new Response(null, { status: 204 });
}
