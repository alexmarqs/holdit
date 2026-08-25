import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { rateLimit } from "@holdit/utils/rate-limit";
import { clientIp } from "@holdit/utils/request";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** How long the CDN may serve a stored copy before asking for a new one. */
const EDGE_TTL_SECONDS = 10;
/** How long it may keep serving the old copy while it fetches a new one. */
const STALE_WHILE_REVALIDATE_SECONDS = 30;

/**
 * The one payload every surface of the wall renders from.
 *
 * Cached at the edge, which is what makes polling affordable: without it every
 * visitor's poll runs `buildMapState` over every purchase row, so cost scales
 * with concurrency — a few thousand people watching at once is a few hundred
 * requests a second. With it the origin recomputes about six times a minute no
 * matter how many people are watching, and the CDN serves the rest.
 *
 * Safe to cache publicly because the payload is identical for everyone. Nothing
 * in it is derived from the request, and nothing on the page is personal: a
 * buyer sees their purchase because it is on the wall, not because the wall
 * knows who they are.
 *
 * `?fresh=` opts out. A buyer's own refetch must not be answered from a copy
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
