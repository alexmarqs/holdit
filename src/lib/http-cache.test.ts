import { describe, expect, it } from "vitest";
import { CACHE } from "./http-cache";

describe("CACHE", () => {
  it("freezes print tags and the print image for the same year", () => {
    expect(CACHE.printHtml).toBe("public, max-age=0, s-maxage=31536000");
    expect(CACHE.printImage).toBe("public, max-age=31536000, s-maxage=31536000, immutable");
  });

  /*
   * `immutable` is a claim that the URL can only ever mean these bytes. An open
   * bucket renders at `now`, so it has not earned one — and the promise would
   * outlive the 30 seconds that make it false by a year.
   */
  it("does not promise a print is settled while its bucket is open", () => {
    expect(CACHE.printImagePending).toBe("public, s-maxage=30");
    expect(CACHE.printImagePending).not.toContain("immutable");
    expect(CACHE.printImagePending).not.toContain("max-age=31536000");
  });

  it("lets the live wall go stale while origin refreshes", () => {
    expect(CACHE.wallState).toBe("public, max-age=0, s-maxage=10, stale-while-revalidate=30");
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
