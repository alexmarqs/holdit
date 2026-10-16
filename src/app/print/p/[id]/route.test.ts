import { beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE } from "@/lib/http-cache";

const purchasePrintAnchor = vi.fn();
const getMapState = vi.fn();

vi.mock("@holdit/db/client", () => ({ db: {} }));
vi.mock("@holdit/db/queries/map", () => ({ getMapState }));
vi.mock("@holdit/db/queries/purchases", () => ({ purchasePrintAnchor }));

const { GET } = await import("./route");

const ID = "11111111-1111-4111-8111-111111111111";

function get(id: string) {
  return GET(new Request(`https://holdit.lol/print/p/${id}`), {
    params: Promise.resolve({ id }),
  });
}

/** A wall in which this purchase's holder sits at 26.67%. */
function wallWithClaim() {
  purchasePrintAnchor.mockResolvedValue({ createdAt: 1_700_000_000_000, holderId: "h1" });
  getMapState.mockResolvedValue({
    standings: [{ holder: { id: "h1", handle: "anthropic.com" }, share: 0.2667 }],
  });
}

describe("GET /print/p/[id]", () => {
  beforeEach(() => {
    purchasePrintAnchor.mockReset();
    getMapState.mockReset();
    purchasePrintAnchor.mockResolvedValue(null);
  });

  it("points og:image at the purchase, not a shared time bucket", async () => {
    const html = await (await get(ID)).text();
    expect(html).toContain(`/api/og?p=${ID}`);
    expect(html).toContain(`/print/p/${ID}`);
    expect((await get(ID)).headers.get("cache-control")).toBe(CACHE.printHtml);
  });

  it("does not let the CDN remember a bounce for junk", async () => {
    const response = await get("nope");
    expect(response.status).toBe(302);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
  });

  /*
   * The words beside the picture are the buyer's claim, not the site's pitch —
   * unfurlers print the title under the image, so this is where a shared square
   * either says whose it is or reads as an advert.
   */
  it("names the square in the unfurled title", async () => {
    wallWithClaim();
    const html = await (await get(ID)).text();
    expect(html).toContain("anthropic.com just took 26.67% of holdit.lol");
    expect(html).toContain("anthropic.com holding 26.67%");
  });

  it("still unfurls when the purchase cannot be read", async () => {
    purchasePrintAnchor.mockResolvedValue(null);
    const response = await get(ID);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("holdit.lol — hold your square of the wall");
    expect(html).toContain(`/api/og?p=${ID}`);
  });

  /*
   * A print link is a share that is already out in the world. A database blip
   * must cost it the personal line, never the card.
   */
  it("still unfurls when the lookup throws", async () => {
    purchasePrintAnchor.mockRejectedValue(new Error("connection reset"));
    const response = await get(ID);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(`/api/og?p=${ID}`);
  });
});
