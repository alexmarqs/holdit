import { db } from "@holdit/db/client";
import { buy } from "@holdit/db/queries/purchases";
import { serverEnv } from "@holdit/utils/env";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Stripe webhook. The only path by which a paid square comes into existence.
 *
 * Two failures are kept strictly apart, because they need opposite answers.
 * A bad signature is a 403 and must never be retried. Anything after that —
 * the database being briefly unreachable, say — is a 500, so Stripe retries and
 * the customer still gets what they paid for. Collapsing both into one catch
 * means a transient outage answers "invalid signature", and a paid square is
 * never built.
 *
 * Redelivery is safe: `recordPurchase` replays the original result for a
 * session id it has already seen, so a retry cannot double-credit anyone.
 */
export async function POST(request: Request) {
  const secret = serverEnv.stripeWebhookSecret;
  const key = serverEnv.stripeSecretKey;
  if (!secret || !key) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 403 });
  }

  // The raw body, byte for byte — Stripe signs the bytes, so parsing first
  // would change them and every signature would fail.
  const raw = await request.text();

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(key);

  let event: import("stripe").Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (error) {
    console.error("Stripe webhook signature rejected", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  /*
   * `checkout.session.completed` only, and only when it is actually paid.
   * `payment_intent.succeeded` describes the same money under a different id,
   * and the id is what deduplicates — accepting both would let one payment
   * insert two purchases and hand the buyer twice the square they paid for.
   */
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
    // Malformed beyond recovery: 400 so it is not retried forever.
    return NextResponse.json({ error: "Session is missing square metadata" }, { status: 400 });
  }

  try {
    const result = await buy(db, {
      target: handle,
      amountCents,
      // Written before paying, so it is the line the square shows once paid.
      tagline: typeof session.metadata?.tagline === "string" ? session.metadata.tagline : null,
      externalOrderId: session.id,
      email: session.customer_details?.email ?? null,
    });
    /*
     * The homepage is prerendered on a 30s interval, so without this the first
     * visitor after a purchase can be handed HTML that predates the square they
     * were told about. The poll on `/api/state` corrects it within ten seconds
     * either way — this only removes the beat where the wall arrives already out
     * of date. It does nothing for the buyer's own return from Stripe, which
     * races this webhook and is the poll's job regardless.
     *
     * Marked, not rebuilt: from a route handler the work happens on the next
     * visit to the path, so a burst of purchases costs one render, not one each.
     *
     * Caught separately because the money is already recorded by this point. A
     * cache refresh that fails is not a reason to answer Stripe with a 500 and
     * have a settled payment redelivered.
     */
    try {
      revalidatePath("/");
    } catch (error) {
      console.error("Stripe webhook could not refresh the wall", error);
    }
    return NextResponse.json({ ok: true, handle: result.holder.handle });
  } catch (error) {
    console.error("Stripe webhook could not record the purchase", error);
    // 500 on purpose: the payment is real, so Stripe must try again.
    return NextResponse.json({ error: "Could not record the purchase" }, { status: 500 });
  }
}
