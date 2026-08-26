import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

const EDGE_TTL_SECONDS = 10; // 10 seconds
const STALE_WHILE_REVALIDATE_SECONDS = 30; // 30 seconds

/**
 * The one payload every surface of the wall renders from.
 *
 * `?fresh=` is Refresh, chase, and a purchase that just landed: `private,
 * no-store`, so the word Refresh means the wall as it is. That path is
 * rate-limited (10 / 10s); a 429 is an empty answer, not a new wall.
 *
 * Without `?fresh=`, the 10s CDN (`s-maxage`) is still needed. First paint is
 * ISR, not this route, but anything that looks without asking — a future poll,
 * `fetchWall(false)`, a crawler — must not stampede Postgres. Ten seconds is
 * a shared copy, not a quote. Do not put the Refresh button back on it.
 */
export async function GET(request: Request) {
  const limited = await rateLimit("state", clientIp(request), { limit: 10, windowSeconds: 10 });

  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const wantsFresh = new URL(request.url).searchParams.has("fresh");

  const state = await getMapState(db);

  return NextResponse.json(state, {
    headers: {
      "cache-control": wantsFresh
        ? "private, no-store"
        : `public, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
    },
  });
}
