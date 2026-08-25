import {
  clampSpend,
  HALF_LIFE_DAYS,
  MAX_SPEND_CENTS,
  MIN_SPEND_CENTS,
  TAGLINE_MAX_CHARS,
} from "@holdit/core";
import { db } from "@holdit/db/client";
import { buy, InvalidTargetError } from "@holdit/db/queries/purchases";
import { normalizeTarget } from "@holdit/utils/domain";
import { isProduction, serverEnv, siteUrl } from "@holdit/utils/env";
import { formatMoney } from "@holdit/utils/format";
import { rateLimit } from "@holdit/utils/rate-limit";
import { clientIp } from "@holdit/utils/request";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  target: z.string().min(1).max(200),
  amountCents: z.number().int().min(MIN_SPEND_CENTS).max(MAX_SPEND_CENTS),
  /*
   * One line under the name on a large square. Optional, and capped short: it
   * has to fit inside a tile, and a paragraph would simply be clipped.
   */
  tagline: z.string().trim().max(TAGLINE_MAX_CHARS).optional(),
});

/**
 * Create a checkout.
 *
 * With a Stripe key this returns a hosted checkout URL and the square appears
 * when the webhook lands. Without one — local development — the purchase is
 * recorded directly so the buy → resize loop is demoable. That bypass is
 * refused in production: it would be a way to take space for free.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("checkout", ip, { limit: 5, windowSeconds: 60 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Enter a domain and an amount of at least ${formatMoney(MIN_SPEND_CENTS)}.` },
      { status: 400 },
    );
  }

  const amountCents = clampSpend(parsed.data.amountCents);
  const normalized = normalizeTarget(parsed.data.target);
  if (!normalized) {
    return NextResponse.json({ error: "That is not a domain or an @handle." }, { status: 400 });
  }

  if (serverEnv.stripeSecretKey) {
    try {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(serverEnv.stripeSecretKey);

      /*
       * A price built per session rather than a catalogue product: the amount
       * is whatever the buyer chose, so there is nothing fixed to point at.
       *
       * Everything the webhook needs travels in `metadata`, because the session
       * is the only thing that comes back and the wall is not touched until the
       * payment actually lands.
       */
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `holdit.lol — a square for ${normalized.handle}`,
                /*
                 * Not "area proportional to spend", which is what this said and
                 * is not what is sold: the display cap stops extra money buying
                 * area at all, and the minimum tile size stops small differences
                 * showing. A share of a sum, fading, is the honest description —
                 * and this is the one place a buyer reads it while paying.
                 */
                description: `A share of the wall, sized against everyone's live spend. Halves every ${HALF_LIFE_DAYS} days.`,
              },
            },
          },
        ],
        metadata: {
          handle: normalized.handle,
          url: normalized.url,
          amountCents: String(amountCents),
          ...(parsed.data.tagline ? { tagline: parsed.data.tagline } : {}),
        },
        success_url: `${siteUrl}/?held=${encodeURIComponent(normalized.handle)}`,
        cancel_url: siteUrl,
      });

      if (!session.url) throw new Error("Stripe returned a session with no URL");
      return NextResponse.json({ checkoutUrl: session.url });
    } catch (error) {
      console.error("Stripe checkout failed", error);
      return NextResponse.json(
        { error: "Checkout is unavailable right now. Nothing was charged." },
        { status: 502 },
      );
    }
  }

  if (isProduction) {
    return NextResponse.json(
      { error: "Payments are not configured. Nothing was charged." },
      { status: 503 },
    );
  }

  try {
    const result = await buy(db, {
      target: parsed.data.target,
      amountCents,
      tagline: parsed.data.tagline ?? null,
    });
    return NextResponse.json({
      recorded: true,
      handle: result.holder.handle,
    });
  } catch (error) {
    if (error instanceof InvalidTargetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Local purchase failed", error);
    return NextResponse.json({ error: "Could not record that purchase." }, { status: 500 });
  }
}
