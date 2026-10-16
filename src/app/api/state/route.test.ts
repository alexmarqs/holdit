import { beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE } from "@/lib/http-cache";

const getMapState = vi.fn();
const rateLimit = vi.fn();

vi.mock("@holdit/db/client", () => ({ db: {} }));
vi.mock("@holdit/db/queries/map", () => ({ getMapState }));
vi.mock("@/lib/utils/rate-limit", () => ({ rateLimit }));

const { GET } = await import("./route");

function get(url: string) {
  return GET(new Request(url));
}

describe("GET /api/state", () => {
  beforeEach(() => {
    getMapState.mockReset();
    getMapState.mockResolvedValue({ standings: [], counters: { squaresLive: 0 } });
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, enforced: false });
  });

  it("lets the CDN hold a routine poll for ten seconds", async () => {
    const response = await get("https://holdit.lol/api/state");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE.wallState);
  });

  it("refuses to cache a buyer refetch that must see their purchase", async () => {
    const response = await get("https://holdit.lol/api/state?fresh=1700000000000");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
  });

  it("rate-limits a fresh Refresh the same as a cached look", async () => {
    rateLimit.mockResolvedValue({ ok: false, enforced: true });
    const response = await get("https://holdit.lol/api/state?fresh=1700000000000");
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
    expect(getMapState).not.toHaveBeenCalled();
  });
});
