import { db } from "@holdit/db/client";
import { buy } from "@holdit/db/queries/purchases";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { externalWebsiteClient } from "@/lib/external-website-client";
import { type StripeEvent, stripeClient } from "@/lib/stripe-client";
import { serverEnv } from "@/lib/utils/env";

/**
 * Stripe webhook. The only path by which a paid square comes into existence.
 */
export async function POST(request: Request) {
  const secret = serverEnv.stripeWebhookSecret;

  if (!stripeClient || !secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 403 });
  }

  const raw = await request.text();

  let event: StripeEvent;
  try {
    event = await stripeClient.webhooks.constructEventAsync(raw, signature, secret);
  } catch (error) {
    console.error("Stripe webhook signature rejected", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ignored: event.type });
  }

  const session = event.data.object;

  if (session.payment_status !== "paid") {
    return NextResponse.json({ ignored: `session.${session.payment_status}` });
  }

  const handle = typeof session.metadata?.handle === "string" ? session.metadata.handle : null;
  const amountCents = Number(session.metadata?.amountCents ?? session.amount_total ?? 0);

  if (!handle || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Session is missing square metadata" }, { status: 400 });
  }

  try {
    const written = typeof session.metadata?.tagline === "string" ? session.metadata.tagline : null;
    const url = typeof session.metadata?.url === "string" ? session.metadata.url : null;

    const result = await buy(db, {
      target: handle,
      amountCents,
      tagline: written,
      fallbackTagline: url ? await externalWebsiteClient.fetchSiteInfo(handle, url, written) : null,
      externalOrderId: session.id,
      email: session.customer_details?.email ?? null,
    });

    try {
      revalidatePath("/");
    } catch (error) {
      console.error("Stripe webhook could not refresh the wall", error);
    }
    return NextResponse.json({ ok: true, handle: result.holder.handle });
  } catch (error) {
    console.error("Stripe webhook could not record the purchase", { sessionId: session.id, error });
    return NextResponse.json({ error: "Could not record the purchase" }, { status: 500 });
  }
}
