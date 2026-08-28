import { db } from "@holdit/db/client";
import { getMapState } from "@holdit/db/queries/map";
import { purchasePrintAnchor } from "@holdit/db/queries/purchases";
import { NextResponse } from "next/server";
import { type PrintClaim, printPurchaseCardHtml } from "@/app/print/[at]/card";
import { CACHE } from "@/lib/http-cache";
import { parsePurchasePrintId } from "@/lib/utils/print-purchase";

/**
 * The square this print belongs to, read at the instant it was bought — the
 * same anchor the image uses, so the words and the picture cannot disagree.
 *
 * Best effort on purpose. An unreadable purchase still has a card worth
 * unfurling, so a failure here costs the personal line and nothing else.
 */
async function claimFor(purchaseId: string): Promise<PrintClaim | undefined> {
  try {
    const anchor = await purchasePrintAnchor(db, purchaseId);
    if (!anchor) return undefined;
    const state = await getMapState(db, { now: anchor.createdAt });
    const standing = state.standings.find((row) => row.holder.id === anchor.holderId);
    return standing ? { handle: standing.holder.handle, share: standing.share } : undefined;
  } catch (error) {
    console.error("Print card could not name the square", { purchaseId, error });
    return undefined;
  }
}

/**
 * Post-pay print. The id is the purchase, so the OG URL cannot collide with a
 * 30-second time bucket that was already frozen without this square.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = parsePurchasePrintId((await context.params).id);

  if (id === null) {
    const bounce = NextResponse.redirect(new URL("/", new URL(request.url)), 302);
    bounce.headers.set("cache-control", CACHE.noStore);
    return bounce;
  }

  return new Response(printPurchaseCardHtml(id, await claimFor(id)), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, follow",
      "cache-control": CACHE.printHtml,
    },
  });
}
