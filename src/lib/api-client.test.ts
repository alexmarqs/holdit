import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, wallStateUrl } from "./api-client";

const NOW = 1_700_000_000_000;

describe("wallStateUrl", () => {
  it("asks the shared edge copy by default", () => {
    expect(wallStateUrl(false)).toBe("/api/state");
  });

  it("busts the CDN with a unique stamp when the purchase must be visible", () => {
    expect(wallStateUrl(true, NOW)).toBe(`/api/state?fresh=${NOW}`);
  });
});

describe("apiClient.fetchWall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not reuse a stored copy in the tab", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ standings: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.fetchWall(false);

    expect(fetchMock).toHaveBeenCalledWith("/api/state", { cache: "no-store" });
  });

  it("skips stored copies when waiting for a paid square", async () => {
    vi.setSystemTime(NOW);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ standings: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.fetchWall(true);

    expect(fetchMock).toHaveBeenCalledWith(`/api/state?fresh=${NOW}`, { cache: "no-store" });
  });

  it("leaves the current wall in place when the pull fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }),
    );
    await expect(apiClient.fetchWall()).rejects.toThrow("Wall unavailable (502)");
  });
});

describe("apiClient.tryFetchWall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the wall when the pull succeeds", async () => {
    const wall = { standings: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => wall }));
    await expect(apiClient.tryFetchWall(true)).resolves.toEqual(wall);
  });

  it("skips a 429 without throwing, so Refresh can stay silent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "Too many requests" }),
      }),
    );
    await expect(apiClient.tryFetchWall(true)).resolves.toBeNull();
  });

  it("skips a dead origin the same way", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(apiClient.tryFetchWall(true)).resolves.toBeNull();
  });
});

describe("apiClient.startCheckout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the target and amount, then returns Stripe's URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ checkoutUrl: "https://checkout.stripe.com/session" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiClient.startCheckout({ target: "linear.app", amountCents: 1000 }),
    ).resolves.toEqual({ ok: true, checkoutUrl: "https://checkout.stripe.com/session" });

    expect(fetchMock).toHaveBeenCalledWith("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "linear.app", amountCents: 1000 }),
    });
  });

  it("returns a recorded handle when Stripe is off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ recorded: true, handle: "linear.app" }),
      }),
    );
    await expect(
      apiClient.startCheckout({ target: "linear.app", amountCents: 100 }),
    ).resolves.toEqual({ ok: true, recorded: true, handle: "linear.app" });
  });

  it("surfaces the server's error instead of inventing one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "linear.app is already at the max size." }),
      }),
    );
    await expect(
      apiClient.startCheckout({ target: "linear.app", amountCents: 100 }),
    ).resolves.toEqual({ ok: false, error: "linear.app is already at the max size." });
  });
});

describe("apiClient.logClick", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("beacons the holder id and does not wait", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    apiClient.logClick("holder_1");

    expect(fetchMock).toHaveBeenCalledWith("/api/clicks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holderId: "holder_1" }),
      keepalive: true,
    });
  });
});

describe("apiClient.recordVisit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers sendBeacon so a closing tab still counts", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchMock);

    apiClient.recordVisit();

    expect(sendBeacon).toHaveBeenCalledWith("/api/visit");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to fetch when sendBeacon is missing", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", fetchMock);

    apiClient.recordVisit();

    expect(fetchMock).toHaveBeenCalledWith("/api/visit", { method: "POST", keepalive: true });
  });
});
