import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { purchasePrintAnchor } from "@holdit/db/queries/purchases";
import { NextResponse } from "next/server";
import { marketingOgImage } from "@/components/map/marketing-og";
import { wallCardModel } from "@/components/map/wall-card";
import { resolveCardLogos, wallOgImage } from "@/components/map/wall-og";
import { CACHE } from "@/lib/http-cache";
import { parsePrintAt, printWallAt } from "@/lib/utils/print-at";
import { parsePurchasePrintId } from "@/lib/utils/print-purchase";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

/**
 * Bare `/api/og` is the marketing poster. `?at=` is a frozen print of the wall
 * at a time bucket. `?p=` is a frozen print of the wall at a purchase — unique,
 * so it cannot reuse a 30-second card that was cached before that buy landed.
 *
 * A present but unreadable stamp must not fall through to marketing: the URL
 * would be `/api/og?at=…`, and the CDN would freeze the wrong card under a key
 * that later becomes a real print.
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

  if (params.has("at") && at === null) {
    return new Response(null, { status: 404, headers: { "cache-control": CACHE.noStore } });
  }

  const image =
    at === null
      ? await marketingOgImage()
      : await wallOgImage(
          await resolveCardLogos(wallCardModel(await getMapState(db, { now: printWallAt(at) }))),
        );

  const headers = new Headers(image.headers);
  headers.set("Cache-Control", at === null ? CACHE.marketingOg : CACHE.printImage);

  return new Response(image.body, { status: image.status, headers });
}
