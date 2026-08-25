import { describe, expect, it } from "vitest";
import { fetchSiteDescription } from "./site-description";

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
    await expect(fetchSiteDescription(url)).resolves.toBeNull();
  });
});
