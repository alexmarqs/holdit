import { describe, expect, it } from "vitest";
import {
  faviconDomain,
  isFaviconDomain,
  isFaviconPlaceholder,
  toFaviconProxyUrl,
  toFaviconUrl,
} from "./favicon";

function pngAt(width: number, height: number, length = 64): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

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

describe("toFaviconUrl", () => {
  it("hotlinks Google so the wall is not a Vercel function per square", () => {
    const url = toFaviconUrl("stripe.com");
    expect(url.startsWith("https://t0.gstatic.com/faviconV2?")).toBe(true);
    expect(url).toContain("url=https%3A%2F%2Fstripe.com");
  });

  it("resolves an @handle to the platform it lives on", () => {
    expect(toFaviconUrl("@someone")).toContain("url=https%3A%2F%2Fx.com");
  });

  it("passes only sizes the endpoint accepts", () => {
    expect(toFaviconUrl("stripe.com", 32)).toContain("size=32");
    expect(toFaviconUrl("stripe.com", 128)).toContain("size=128");
  });

  it("escapes the domain rather than interpolating it raw", () => {
    expect(toFaviconUrl("a b.com" as string)).toContain("a%20b.com");
  });
});

describe("Google's placeholder globe", () => {
  it("is a 16px PNG even when we asked for 64 or 128", () => {
    expect(isFaviconPlaceholder(pngAt(16, 16))).toBe(true);
    expect(isFaviconPlaceholder(16)).toBe(true);
  });

  it("keeps a mark that actually came back at the size we asked", () => {
    expect(isFaviconPlaceholder(pngAt(64, 64))).toBe(false);
    expect(isFaviconPlaceholder(64)).toBe(false);
  });

  it("does not reject bytes we cannot measure", () => {
    expect(isFaviconPlaceholder(new Uint8Array(64).fill(9))).toBe(false);
  });
});

describe("toFaviconProxyUrl", () => {
  it("is one same-origin path per domain, so the CDN can hold it", () => {
    expect(toFaviconProxyUrl("linear.app")).toBe("/api/favicons/linear.app");
  });

  it("collapses @handles onto the host they borrow, so they share a cache key", () => {
    expect(toFaviconProxyUrl("@someone")).toBe("/api/favicons/x.com");
  });
});
