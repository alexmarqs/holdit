import { beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE } from "@/lib/http-cache";

const fetchFavicon = vi.fn();
const rateLimit = vi.fn();

vi.mock("@/lib/external-website-client", () => ({
  externalWebsiteClient: { fetchFavicon },
}));
vi.mock("@/lib/utils/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/utils/request", () => ({ clientIp: () => "127.0.0.1" }));

const { GET } = await import("./route");

function get(domain: string) {
  return GET(new Request(`https://holdit.lol/api/favicons/${domain}`), {
    params: Promise.resolve({ domain }),
  });
}

describe("GET /api/favicons/[domain]", () => {
  beforeEach(() => {
    fetchFavicon.mockReset();
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, enforced: false });
  });

  it("returns the bytes with a CDN TTL so a second download skips the function", async () => {
    const png = new Uint8Array(64).fill(9);
    fetchFavicon.mockResolvedValue({ bytes: png, contentType: "image/png" });

    const response = await get("linear.app");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(CACHE.favicon);
    expect(fetchFavicon).toHaveBeenCalledWith("linear.app", 128);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
  });

  it("lowercases the path so Stripe.COM and stripe.com share a cache key", async () => {
    fetchFavicon.mockResolvedValue({ bytes: new Uint8Array(64).fill(1), contentType: "image/png" });
    await get("Stripe.COM");
    expect(fetchFavicon).toHaveBeenCalledWith("stripe.com", 128);
  });

  it("refuses a host we would not hotlink without asking Google", async () => {
    const response = await get("127.0.0.1");
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(CACHE.faviconInvalidDomain);
    expect(fetchFavicon).not.toHaveBeenCalled();
  });

  it("caches a Google miss for minutes, not a month", async () => {
    fetchFavicon.mockResolvedValue(null);
    const response = await get("linear.app");
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(CACHE.faviconMiss);
  });

  it("does not let the CDN hold a 429", async () => {
    rateLimit.mockResolvedValue({ ok: false, enforced: true });
    const response = await get("linear.app");
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
    expect(fetchFavicon).not.toHaveBeenCalled();
  });
});
