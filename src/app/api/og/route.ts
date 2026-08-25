import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { serverEnv } from "@holdit/utils/env";
import { parsePrintAt } from "@holdit/utils/print-at";
import { rateLimit } from "@holdit/utils/rate-limit";
import { clientIp } from "@holdit/utils/request";
import { NextResponse } from "next/server";
import { marketingOgImage } from "@/components/map/marketing-og";
import { wallCardModel } from "@/components/map/wall-card";
import { resolveCardLogos, wallOgImage } from "@/components/map/wall-og";

/**
 * Bare `/api/og` is the marketing poster. `?at=` is a frozen print of the wall.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  /*
   * The costliest route here by a wide margin: a full Satori render plus one
   * outbound favicon fetch per square. `at` is caller-controlled, so every
   * distinct value is a guaranteed cache miss — a loop over random values
   * bypasses the CDN completely and bills straight to the function.
   *
   * Every real request is an unfurl, fetched by a social crawler and served
   * from the CDN almost always, so the limit is loose: throttling would break
   * the preview on a post that is going viral, the worst possible moment.
   */
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
  /*
   * `immutable` was wrong here, and wrong in a way that could not be undone.
   * The bytes at `?at=T` are a function of T *and* the code that draws them, so
   * a deploy changes the content at an unchanged URL — while `immutable` told
   * every browser not to ask again for a year, leaving a bad render permanent.
   *
   * A print should stay stable for the post that embeds it, so the CDN holds it
   * for a year — but the browser still checks back, and a fix always lands.
   */
  const headers = new Headers(image.headers);
  headers.set(
    "Cache-Control",
    at === null
      ? "public, s-maxage=86400, stale-while-revalidate=604800"
      : "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=604800",
  );
  return new Response(image.body, { status: image.status, headers });
}
