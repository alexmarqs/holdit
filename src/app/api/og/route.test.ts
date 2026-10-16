import { beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE } from "@/lib/http-cache";
import { PRINT_BUCKET_MS } from "@/lib/utils/print-at";

const getMapState = vi.fn();
const purchasePrintAnchor = vi.fn();
const wallCardModel = vi.fn(() => ({ tiles: [] }));
const wallOgImage = vi.fn();
const rateLimit = vi.fn();

vi.mock("@holdit/db/client", () => ({ db: {} }));
vi.mock("@holdit/db/queries/map", () => ({ getMapState }));
vi.mock("@holdit/db/queries/purchases", () => ({ purchasePrintAnchor }));
vi.mock("@/components/map/wall-og", () => ({
  resolveCardLogos: vi.fn(async (card: unknown) => card),
  wallOgImage,
}));
vi.mock("@/components/map/wall-card", () => ({ wallCardModel }));
vi.mock("@/lib/utils/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/utils/request", () => ({ clientIp: () => "127.0.0.1" }));

const { GET } = await import("./route");

const AT = Date.UTC(2026, 7, 22, 11, 37);

function png() {
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "content-type": "image/png" },
  });
}

describe("GET /api/og", () => {
  beforeEach(() => {
    getMapState.mockReset();
    getMapState.mockResolvedValue({ standings: [] });
    purchasePrintAnchor.mockReset();
    purchasePrintAnchor.mockResolvedValue(null);
    wallCardModel.mockReset();
    wallCardModel.mockReturnValue({ tiles: [] });
    wallOgImage.mockReset();
    wallOgImage.mockResolvedValue(png());
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, enforced: false });
  });

  /*
   * The poster moved to `app/opengraph-image.tsx`. Answering an unstamped
   * request with an image again is what this guards: it was a render a day for
   * identical bytes, and a fresh CDN key for every unread parameter.
   */
  it.each([
    ["nothing", ""],
    ["an unread parameter", "?x=1"],
  ])("has no image for a request stamped with %s", async (_name, query) => {
    const response = await GET(new Request(`https://holdit.lol/api/og${query}`));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
    expect(wallOgImage).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("freezes a print image forever — one stamp, same pixels", async () => {
    const response = await GET(new Request(`https://holdit.lol/api/og?at=${AT}`));
    expect(response.headers.get("cache-control")).toBe(CACHE.printImage);
    expect(getMapState).toHaveBeenCalledWith(expect.anything(), { now: AT + PRINT_BUCKET_MS - 1 });
    expect(wallCardModel).toHaveBeenCalledWith(expect.anything());
  });

  /*
   * The counterpart to the test above. `AT` is long past, so its wall can no
   * longer change and the year is earned; a bucket still open renders at `now`,
   * so the same URL would not mean the same pixels and must not be frozen.
   *
   * The stamp is nudged a minute ahead rather than using the current bucket:
   * `parsePrintAt` accepts it inside the two-minute skew, and it cannot close
   * mid-test the way the live bucket can in its final millisecond.
   */
  it("does not freeze a print whose bucket is still open", async () => {
    const open = Math.floor((Date.now() + 60_000) / PRINT_BUCKET_MS) * PRINT_BUCKET_MS;
    const response = await GET(new Request(`https://holdit.lol/api/og?at=${open}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE.printImagePending);
  });

  it("does not cache the marketing poster under a junk stamp", async () => {
    const response = await GET(new Request("https://holdit.lol/api/og?at=nope"));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
    expect(wallOgImage).not.toHaveBeenCalled();
  });

  it("does not freeze a 404 under a stamp that is still in the future", async () => {
    const future = Date.now() + 10 * 60_000;
    const response = await GET(new Request(`https://holdit.lol/api/og?at=${future}`));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
  });

  it("freezes a purchase print at that buy, not the 30s bucket", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const bought = AT + 15_000;
    purchasePrintAnchor.mockResolvedValue({ createdAt: bought, holderId: "holder-1" });
    const response = await GET(new Request(`https://holdit.lol/api/og?p=${id}`));
    expect(response.headers.get("cache-control")).toBe(CACHE.printImage);
    expect(getMapState).toHaveBeenCalledWith(expect.anything(), { now: bought });
    expect(wallCardModel).toHaveBeenCalledWith(expect.anything(), "light", "holder-1");
  });

  it("does not cache a miss for an unknown purchase", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const response = await GET(new Request(`https://holdit.lol/api/og?p=${id}`));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
    expect(getMapState).not.toHaveBeenCalled();
  });

  /*
   * Both stamps are enumerable and each distinct value is a guaranteed CDN
   * miss. A real share is not caught by this: `printImage` is immutable, so a
   * stamp misses once and hits forever after.
   */
  it.each([
    ["at", `at=${AT}`],
    ["p", "p=11111111-1111-4111-8111-111111111111"],
  ])("limits ?%s, where every distinct value is a fresh key past the CDN", async (_name, query) => {
    rateLimit.mockResolvedValue({ ok: false, enforced: true });
    const response = await GET(new Request(`https://holdit.lol/api/og?${query}`));
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
    expect(getMapState).not.toHaveBeenCalled();
  });
});
