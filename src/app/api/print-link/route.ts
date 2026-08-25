import { serverEnv } from "@holdit/utils/env";
import { mintPrintAt } from "@holdit/utils/print-at";
import { rateLimit } from "@holdit/utils/rate-limit";
import { clientIp } from "@holdit/utils/request";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({ at: z.number().int() });

/**
 * Sign a print so `/api/og` may skip the five-minute grid.
 *
 * Unsigned stamps are bucketed on purpose: every distinct `at` is a full
 * Satori render. A paid share is the exception — rounding back can drop the
 * square that just landed — and this is the only way to mint that exception.
 * The window is short and the route is rate-limited, so it is not a way to
 * force a unique render for an arbitrary stamp.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("print-link", ip, { limit: 10, windowSeconds: 60 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many print requests." }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing print stamp." }, { status: 400 });
  }

  const minted = mintPrintAt(parsed.data.at, Date.now(), serverEnv.clickHashSalt);
  if (!minted) {
    return NextResponse.json({ error: "That print is too old to sign." }, { status: 400 });
  }

  return NextResponse.json(minted, {
    headers: { "cache-control": "no-store" },
  });
}

export function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}
