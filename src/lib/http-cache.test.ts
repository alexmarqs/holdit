import { describe, expect, it } from "vitest";
import { CACHE } from "./http-cache";

describe("CACHE", () => {
  it("freezes print tags and the print image for the same year", () => {
    expect(CACHE.printHtml).toBe("public, max-age=0, s-maxage=31536000, immutable");
    expect(CACHE.printImage).toBe("public, max-age=31536000, s-maxage=31536000, immutable");
  });

  it("lets marketing and the live wall go stale while origin refreshes", () => {
    expect(CACHE.marketingOg).toBe("public, s-maxage=86400, stale-while-revalidate=604800");
    expect(CACHE.wallState).toBe("public, s-maxage=10, stale-while-revalidate=30");
  });

  it("gives a downloaded logo a day in the tab and a month on the edge", () => {
    expect(CACHE.favicon).toBe(
      "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
    );
    expect(CACHE.faviconMiss).toBe("public, s-maxage=300");
    expect(CACHE.faviconInvalidDomain).toBe("public, s-maxage=86400");
  });

  it("never lets the CDN hold a 429 or a stamp that is not a wall yet", () => {
    expect(CACHE.noStore).toBe("private, no-store");
  });
});
