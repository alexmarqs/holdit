import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFavicon = vi.fn();
const rateLimit = vi.fn();

vi.mock("@/lib/external-website-client", () => ({
  externalWebsiteClient: { fetchFavicon },
}));
vi.mock("@/lib/utils/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/utils/request", () => ({ clientIp: () => "127.0.0.1" }));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(
    new Request("https://holdit.lol/api/favicons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/favicons", () => {
  beforeEach(() => {
    fetchFavicon.mockReset();
    rateLimit.mockReset();
    rateLimit.mockResolvedValue({ ok: true, enforced: false });
  });

  it("returns a data URL for each handle so a download can paint logos", async () => {
    const png = new Uint8Array(64).fill(9);
    fetchFavicon.mockResolvedValue({ bytes: png, contentType: "image/png" });

    const response = await post({ handles: ["linear.app", "stripe.com"] });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { logos: Record<string, string> };
    expect(body.logos["linear.app"]?.startsWith("data:image/png;base64,")).toBe(true);
    expect(body.logos["stripe.com"]?.startsWith("data:image/png;base64,")).toBe(true);
    expect(fetchFavicon).toHaveBeenCalledWith("linear.app", 128);
  });

  it("refuses a host we would not hotlink", async () => {
    const response = await post({ handles: ["http://127.0.0.1"] });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { logos: Record<string, string> };
    expect(body.logos).toEqual({});
    expect(fetchFavicon).not.toHaveBeenCalled();
  });
});
