import { describe, expect, it } from "vitest";
import { faviconDomain, isFaviconDomain } from "./favicon";

/**
 * The domain never becomes a host we connect to — it is interpolated into a URL
 * built against a hardcoded upstream. These guard the input anyway, so a
 * malformed value is refused at the door rather than passed upstream.
 */
describe("favicon domains", () => {
  it("accepts ordinary hostnames", () => {
    for (const d of ["stripe.com", "a.co", "sub.domain.example.org", "x-y.dev"]) {
      expect(isFaviconDomain(d), d).toBe(true);
    }
  });

  it("refuses anything that is not one", () => {
    for (const d of [
      "",
      "localhost",
      "127.0.0.1",
      "no-dot",
      "-lead.com",
      "trail-.com",
      "spaces here.com",
      "has/slash.com",
      "has?query.com",
      "javascript:alert(1)",
      "//evil.com",
      `${"a".repeat(300)}.com`,
    ]) {
      expect(isFaviconDomain(d), JSON.stringify(d)).toBe(false);
    }
  });

  it("sends a handle to the platform that hosts it", () => {
    expect(faviconDomain("@someone")).toBe("x.com");
    expect(faviconDomain("Stripe.COM")).toBe("stripe.com");
  });
});
