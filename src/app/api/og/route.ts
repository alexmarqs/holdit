import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { NextResponse } from "next/server";
import { marketingOgImage } from "@/components/map/marketing-og";
import { wallCardModel } from "@/components/map/wall-card";
import { resolveCardLogos, wallOgImage } from "@/components/map/wall-og";
import { CACHE } from "@/lib/http-cache";
import { parsePrintAt } from "@/lib/utils/print-at";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

/**
 * Bare `/api/og` is the marketing poster. `?at=` is a frozen print of the wall.
 * That image is a reconstruction at one instant, so the CDN is told `immutable`.
 *
 * A present but unreadable `at` (junk, or a stamp still in the future) must not
 * fall through to marketing: the URL would be `/api/og?at=…`, and the CDN would
 * freeze the wrong card under a key that later becomes a real print.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const limited = await rateLimit("og-unfurl", clientIp(request), {
    limit: 40,
    windowSeconds: 60,
  });

  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many image requests." },
      { status: 429, headers: { "cache-control": CACHE.noStore } },
    );
  }

  const at = parsePrintAt(params.get("at"));

  if (params.has("at") && at === null) {
    return new Response(null, { status: 404, headers: { "cache-control": CACHE.noStore } });
  }

  const image =
    at === null
      ? await marketingOgImage()
      : await wallOgImage(
          await resolveCardLogos(wallCardModel(await getMapState(db, { now: at }))),
        );

  const headers = new Headers(image.headers);
  headers.set("Cache-Control", at === null ? CACHE.marketingOg : CACHE.printImage);

  return new Response(image.body, { status: image.status, headers });
}
