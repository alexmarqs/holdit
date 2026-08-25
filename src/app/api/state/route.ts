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
 * Cached at the edge, but `?fresh=` opts out. A buyer's own refetch must not be answered from a copy
 * stored before their purchase — staring at an unchanged wall for ten seconds
 * having just paid is the one moment staleness is unacceptable.
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
