import { NextResponse } from "next/server";
import { printPurchaseCardHtml } from "@/app/print/[at]/card";
import { CACHE } from "@/lib/http-cache";
import { parsePurchasePrintId } from "@/lib/utils/print-purchase";

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

  return new Response(printPurchaseCardHtml(id), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, follow",
      "cache-control": CACHE.printHtml,
    },
  });
}
