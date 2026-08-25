import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { NextResponse } from "next/server";
import { marketingOgImage } from "@/components/map/marketing-og";
import { wallCardModel } from "@/components/map/wall-card";
import { resolveCardLogos, wallOgImage } from "@/components/map/wall-og";
import { serverEnv } from "@/lib/utils/env";
import { parsePrintAt } from "@/lib/utils/print-at";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

const MARKETING_EDGE_TTL_SECONDS = 86_400; // 1 day
const MARKETING_STALE_WHILE_REVALIDATE_SECONDS = 604_800; // 1 week

const WALL_BROWSER_TTL_SECONDS = 3_600; // 1 hour
const WALL_EDGE_TTL_SECONDS = 31_536_000; // 1 year
const WALL_STALE_WHILE_REVALIDATE_SECONDS = 604_800; // 1 week

/**
 * Bare `/api/og` is the marketing poster. `?at=` is a frozen print of the wall.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const limited = await rateLimit("og-unfurl", clientIp(request), {
    limit: 40,
    windowSeconds: 60,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many image requests." }, { status: 429 });
  }

  const at = parsePrintAt(params.get("at"), Date.now(), {
    proof: params.get("p"),
    secret: serverEnv.clickHashSalt,
  });

  const image =
    at === null
      ? await marketingOgImage()
      : await wallOgImage(
          await resolveCardLogos(wallCardModel(await getMapState(db, { now: at }))),
        );

  const headers = new Headers(image.headers);

  headers.set(
    "Cache-Control",
    at === null
      ? `public, s-maxage=${MARKETING_EDGE_TTL_SECONDS}, stale-while-revalidate=${MARKETING_STALE_WHILE_REVALIDATE_SECONDS}`
      : `public, max-age=${WALL_BROWSER_TTL_SECONDS}, s-maxage=${WALL_EDGE_TTL_SECONDS}, stale-while-revalidate=${WALL_STALE_WHILE_REVALIDATE_SECONDS}`,
  );

  return new Response(image.body, { status: image.status, headers });
}
