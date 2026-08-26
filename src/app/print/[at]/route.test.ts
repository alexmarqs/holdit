import { describe, expect, it } from "vitest";
import { CACHE } from "@/lib/http-cache";
import { GET } from "./route";

const AT = Date.UTC(2026, 7, 22, 11, 37);

function get(at: string) {
  return GET(new Request(`https://holdit.lol/print/${at}`), {
    params: Promise.resolve({ at }),
  });
}

describe("GET /print/[at]", () => {
  it("lets the CDN hold the unfurl tags forever, not the browser", async () => {
    const response = await get(String(AT));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE.printHtml);
  });

  it("passes the bucketed stamp into the card so og:image can freeze that wall", async () => {
    const html = await (await get(String(AT))).text();
    expect(html).toContain(`/api/og?at=${AT}`);
    expect(html).toContain(`/print/${AT}`);
  });

  it("sends a junk stamp to the live wall", async () => {
    const response = await get("nope");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://holdit.lol/");
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
  });

  it("does not let the CDN remember a bounce for a stamp that is still in the future", async () => {
    const future = String(Date.now() + 10 * 60_000);
    const response = await get(future);
    expect(response.status).toBe(302);
    expect(response.headers.get("cache-control")).toBe(CACHE.noStore);
  });
});
