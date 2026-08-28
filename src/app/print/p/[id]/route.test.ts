import { describe, expect, it } from "vitest";
import { CACHE } from "@/lib/http-cache";
import { GET } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";

function get(id: string) {
  return GET(new Request(`https://holdit.lol/print/p/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /print/p/[id]", () => {
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
});
