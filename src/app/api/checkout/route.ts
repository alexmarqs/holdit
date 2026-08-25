import { clampSpend, HALF_LIFE_DAYS, MIN_SPEND_CENTS, TAGLINE_MAX_CHARS } from "@holdit/core";
import { db } from "@holdit/db/client";
import { buy, InvalidTargetError } from "@holdit/db/queries/purchases";
import { NextResponse } from "next/server";
import { z } from "zod";
import { externalWebsiteClient } from "@/lib/external-website-client";
import { stripeClient } from "@/lib/stripe-client";
import { normalizeTarget } from "@/lib/utils/domain";
import { isProduction, siteUrl } from "@/lib/utils/env";
import { formatMoney } from "@/lib/utils/format";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

const CreateCheckoutRequest = z.object({
  target: z.string().min(1).max(200),
  amountCents: z.number().int().min(MIN_SPEND_CENTS),
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

  const parsed = CreateCheckoutRequest.safeParse(await request.json().catch(() => null));

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

  if (stripeClient) {
    try {
      const session = await stripeClient.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `holdit.lol — a square for ${normalized.handle}`,
                description: `A share of the wall, sized against everyone's live spend. New spend takes a slice sized to what they paid. Live spend is half every ${HALF_LIFE_DAYS} days if nobody buys.`,
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
    const written = parsed.data.tagline ?? null;
    const result = await buy(db, {
      target: parsed.data.target,
      amountCents,
      tagline: written,
      fallbackTagline: await externalWebsiteClient.fetchSiteInfo(
        normalized.handle,
        normalized.url,
        written,
      ),
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
