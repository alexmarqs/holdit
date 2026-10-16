import { MAX_SPEND_CENTS } from "@holdit/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMapState = vi.fn();
const buy = vi.fn();
const rateLimit = vi.fn();
const createSession = vi.fn();

vi.mock("@holdit/db/client", () => ({ db: {} }));
vi.mock("@holdit/db/queries/map", () => ({ getMapState }));
vi.mock("@holdit/db/queries/purchases", () => ({
  buy,
  InvalidTargetError: class InvalidTargetError extends Error {},
}));
vi.mock("@/lib/utils/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/utils/request", () => ({ clientIp: () => "127.0.0.1" }));
vi.mock("@/lib/stripe-client", () => ({
  stripeClient: {
    checkout: { sessions: { create: (...args: unknown[]) => createSession(...args) } },
  },
}));
vi.mock("@/lib/utils/env", () => ({ isProduction: false, siteUrl: "https://holdit.lol" }));
vi.mock("@/lib/external-website-client", () => ({
  externalWebsiteClient: { fetchSiteInfo: vi.fn() },
}));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(
    new Request("https://holdit.lol/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/checkout", () => {
  beforeEach(() => {
    getMapState.mockReset();
    buy.mockReset();
    createSession.mockReset();
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, enforced: false });
    getMapState.mockResolvedValue({ standings: [] });
    createSession.mockResolvedValue({ url: "https://checkout.stripe.com/session" });
  });

  it("still charges a square that is already at the max size — extra is hold, not size", async () => {
    getMapState.mockResolvedValue({
      counters: { squaresLive: 16 },
      standings: [{ holder: { handle: "linear.app" }, capped: true, share: 0.1 }],
    });

    const response = await post({ target: "linear.app", amountCents: 10_000 });
    expect(response.status).toBe(200);
    expect(createSession).toHaveBeenCalledOnce();
  });

  it("still charges a square that can grow", async () => {
    getMapState.mockResolvedValue({
      standings: [{ holder: { handle: "linear.app" }, capped: false, share: 0.04 }],
    });

    const response = await post({ target: "linear.app", amountCents: 1000 });
    expect(response.status).toBe(200);
    expect(createSession).toHaveBeenCalledOnce();
  });

  /*
   * The field clamps to the top of the ladder, so only a hand-rolled request
   * gets here. It must still be refused: the amount lands in Stripe's
   * `unit_amount` verbatim, and a session quoting more than the wall ever
   * offers is a price the product never named.
   */
  it("refuses an amount above the top of the ladder", async () => {
    const response = await post({ target: "linear.app", amountCents: 999_999_999 });
    expect(response.status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("charges the top of the ladder itself", async () => {
    const response = await post({ target: "linear.app", amountCents: MAX_SPEND_CENTS });
    expect(response.status).toBe(200);
    expect(createSession).toHaveBeenCalledOnce();
  });
});
