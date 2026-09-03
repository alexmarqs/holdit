import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { purchasePrintAnchor } from "@holdit/db/queries/purchases";
import { NextResponse } from "next/server";
import { wallCardModel } from "@/components/map/wall-card";
import { resolveCardLogos, wallOgImage } from "@/components/map/wall-og";
import { CACHE } from "@/lib/http-cache";
import { parsePrintAt, printBucketClosed, printWallAt } from "@/lib/utils/print-at";
import { parsePurchasePrintId } from "@/lib/utils/print-purchase";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

/**
 * Frozen prints of the wall. `?at=` is a time bucket; `?p=` is a purchase —
 * unique, so it cannot reuse a 30-second card that was cached before that buy
 * landed.
 *
 * A present but unreadable stamp gets a 404 rather than a fallback image: the
 * URL would be `/api/og?at=…`, and the CDN would freeze the wrong card under a
 * key that later becomes a real print.
 *
 * The marketing poster is no longer here — it is `app/opengraph-image.tsx`,
 * which Next renders at build. It never depended on the request, so a route was
 * paying a render a day to reproduce identical bytes, and every unread
 * parameter minted a fresh cache key that rendered it again.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  /*
   * A stamp is the whole contract now, so anything else is answered before it
   * can cost anything — no render, no query, and nothing the CDN will keep.
   */
  if (!params.has("at") && !params.has("p")) {
    return new Response(null, { status: 404, headers: { "cache-control": CACHE.noStore } });
  }

  /*
   * Both stamps are caller-controlled and enumerable — `parsePrintAt` accepts
   * six years of 30-second buckets — and each distinct value is a guaranteed
   * CDN miss billed as a render plus a favicon fetch per square.
   *
   * A real share is not what this catches. `printImage` is immutable, so a
   * given stamp misses once and is a hit forever after: one request per
   * purchase reaches this line, ever. Tripping 40 in a minute takes 40 stamps
   * nobody has ever unfurled, from one address.
   */
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

  const purchaseId = params.has("p") ? parsePurchasePrintId(params.get("p")) : null;
  if (params.has("p") && purchaseId === null) {
    return new Response(null, { status: 404, headers: { "cache-control": CACHE.noStore } });
  }

  if (purchaseId !== null) {
    const anchor = await purchasePrintAnchor(db, purchaseId);
    if (anchor === null) {
      return new Response(null, { status: 404, headers: { "cache-control": CACHE.noStore } });
    }
    const image = await wallOgImage(
      await resolveCardLogos(
        wallCardModel(await getMapState(db, { now: anchor.createdAt }), "light", anchor.holderId),
      ),
    );
    const headers = new Headers(image.headers);
    headers.set("Cache-Control", CACHE.printImage);
    return new Response(image.body, { status: image.status, headers });
  }

  const at = parsePrintAt(params.get("at"));

  if (at === null) {
    return new Response(null, { status: 404, headers: { "cache-control": CACHE.noStore } });
  }

  /*
   * One clock for both questions. `printWallAt` clamps an open bucket to `now`,
   * so what gets rendered and whether it may be frozen are the same decision —
   * read separately, a millisecond either side of the boundary could freeze a
   * card that was still clamped, for a year.
   */
  const now = Date.now();
  const image = await wallOgImage(
    await resolveCardLogos(wallCardModel(await getMapState(db, { now: printWallAt(at, now) }))),
  );

  const headers = new Headers(image.headers);
  headers.set(
    "Cache-Control",
    printBucketClosed(at, now) ? CACHE.printImage : CACHE.printImagePending,
  );

  return new Response(image.body, { status: image.status, headers });
}
