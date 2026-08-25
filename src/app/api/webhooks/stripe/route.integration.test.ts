import { beforeEach, describe, expect, it } from "vitest";

/**
 * The money path, driven end to end with payloads signed by Stripe's own SDK.
 *
 * This is the one route that has never run against the real service, and the
 * one where a mistake means somebody paid and got nothing. Signing a genuine
 * payload exercises exactly what a live delivery hits: signature verification,
 * event filtering, metadata parsing and replay protection.
 *
 * Nothing here leaves the machine — Stripe's SDK signs locally and the purchase
 * lands in the local container — but it does need that container running.
 */

const SECRET = "whsec_testsecretforholditlol0000000000";

process.env.STRIPE_SECRET_KEY = "sk_test_notarealkey";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;

const { default: Stripe } = await import("stripe");
const { db } = await import("@holdit/db/client");
const { loadMapDataset } = await import("@holdit/db/queries/dataset");
const { resetDatabase } = await import("@holdit/db/testing");
const { POST } = await import("./route");
const { buildMapState } = await import("@holdit/core");

const stripe = new Stripe("sk_test_notarealkey");

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_abc123",
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 2_500,
    customer_details: { email: "buyer@example.com" },
    /*
     * A tagline is supplied so these stay hermetic. Without one, the webhook
     * reads the destination's own description — a real outbound request with a
     * 3s ceiling, which both slows the test and reaches the network. That path
     * is covered in money.integration.test.ts against the repository directly.
     */
    metadata: {
      handle: "buyer.com",
      url: "https://buyer.com",
      amountCents: "2500",
      tagline: "Set so the test never leaves the machine.",
    },
    ...overrides,
  };
}

function deliver(payload: unknown, opts: { sign?: boolean; type?: string } = {}) {
  const body = JSON.stringify({
    id: "evt_1",
    object: "event",
    type: opts.type ?? "checkout.session.completed",
    data: { object: payload },
  });
  const headers = new Headers({ "content-type": "application/json" });
  if (opts.sign !== false) {
    headers.set(
      "stripe-signature",
      stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET }),
    );
  }
  return POST(
    new Request("https://holdit.lol/api/webhooks/stripe", { method: "POST", body, headers }),
  );
}

const wall = async () => {
  const now = Date.now();
  return buildMapState({ ...(await loadMapDataset(db, now)), now });
};

describe("the Stripe webhook", () => {
  beforeEach(resetDatabase);

  it("builds the square when a real signed payment lands", async () => {
    const response = await deliver(session());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, handle: "buyer.com" });

    const state = await wall();
    expect(state.standings).toHaveLength(1);
    // Decay is continuous, so a few milliseconds have already elapsed.
    expect(state.counters.liveCents).toBeCloseTo(2_500, 2);
  });

  it("refuses an unsigned delivery", async () => {
    const response = await deliver(session(), { sign: false });
    expect(response.status).toBe(403);
    expect((await wall()).standings).toHaveLength(0);
  });

  it("refuses a payload signed with the wrong secret", async () => {
    const body = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: session() },
    });
    const response = await POST(
      new Request("https://holdit.lol/api/webhooks/stripe", {
        method: "POST",
        body,
        headers: {
          "stripe-signature": stripe.webhooks.generateTestHeaderString({
            payload: body,
            secret: "whsec_someoneelsessecret000000000000",
          }),
        },
      }),
    );
    expect(response.status).toBe(403);
    expect((await wall()).standings).toHaveLength(0);
  });

  it("refuses a tampered body under a valid-looking signature", async () => {
    const original = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: session() },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: original,
      secret: SECRET,
    });
    const tampered = original.replace('"2500"', '"250000"');
    const response = await POST(
      new Request("https://holdit.lol/api/webhooks/stripe", {
        method: "POST",
        body: tampered,
        headers: { "stripe-signature": signature },
      }),
    );
    expect(response.status).toBe(403);
    expect((await wall()).standings).toHaveLength(0);
  });

  it("credits a redelivered event exactly once", async () => {
    await deliver(session());
    await deliver(session());
    await deliver(session());
    const state = await wall();
    expect(state.standings).toHaveLength(1);
    expect(state.counters.liveCents).toBeCloseTo(2_500, 2);
  });

  it("ignores an unpaid session", async () => {
    const response = await deliver(session({ payment_status: "unpaid" }));
    expect(await response.json()).toEqual({ ignored: "session.unpaid" });
    expect((await wall()).standings).toHaveLength(0);
  });

  it("ignores every event type but the completed session", async () => {
    for (const type of ["payment_intent.succeeded", "charge.succeeded", "invoice.paid"]) {
      const response = await deliver(session(), { type });
      expect(await response.json()).toEqual({ ignored: type });
    }
    // One payment must never become several squares under different ids.
    expect((await wall()).standings).toHaveLength(0);
  });

  it("rejects a session with no square metadata, without retrying forever", async () => {
    const response = await deliver(session({ metadata: {} }));
    expect(response.status).toBe(400);
  });

  it("carries the buyer's tagline through to the square", async () => {
    await deliver(
      session({
        metadata: { handle: "buyer.com", amountCents: "2500", tagline: "Written before paying." },
      }),
    );
    expect((await wall()).standings[0]?.holder.tagline).toBe("Written before paying.");
  });
});
