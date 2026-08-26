import { afterEach, describe, expect, it, vi } from "vitest";
import { externalWebsiteClient } from "./external-website-client";
import { FAVICON_DATA_REVALIDATE_SECONDS } from "./http-cache";
import { toFaviconUrl } from "./utils/favicon";

/**
 * The URL is supplied by whoever is buying and the fetch runs on our server, so
 * these are the cases that matter most: the ones that must never leave the box.
 */
describe("refuses to be pointed at the inside", () => {
  const forbidden = [
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://10.0.0.1/admin",
    "http://192.168.1.1/",
    "http://172.16.0.5/",
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "http://[::1]/",
    "http://db.internal/",
    "http://printer.local/",
    "file:///etc/passwd",
    "ftp://example.com/",
    "not a url at all",
  ];

  it.each(forbidden)("refuses %s", async (url) => {
    await expect(externalWebsiteClient.fetchSiteInfo("example.com", url, null)).resolves.toBeNull();
  });
});

describe("fetchSiteInfo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch when the buyer wrote a line", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      externalWebsiteClient.fetchSiteInfo("linear.app", "https://linear.app", "Plan and build."),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch for an @handle — the host's meta is not about them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      externalWebsiteClient.fetchSiteInfo("@holdit", "https://x.com/holdit", null),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchFavicon", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opts Google into the Data Cache so two prints share one fetch", async () => {
    const png = new Uint8Array(64).fill(9);
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(png, { headers: { "content-type": "image/png" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(externalWebsiteClient.fetchFavicon("linear.app", 128)).resolves.toEqual({
      bytes: png,
      contentType: "image/png",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      toFaviconUrl("linear.app", 128),
      expect.objectContaining({
        cache: "force-cache",
        next: { revalidate: FAVICON_DATA_REVALIDATE_SECONDS },
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("signal");
  });
});
