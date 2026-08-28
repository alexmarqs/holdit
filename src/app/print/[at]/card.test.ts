import { describe, expect, it } from "vitest";
import { OG_SIZE } from "@/components/map/og-fonts";
import { siteUrl } from "@/lib/utils/env";
import { printCardHtml, printPurchaseCardHtml } from "./card";

describe("printCardHtml", () => {
  const at = Date.UTC(2026, 7, 22, 11, 37);
  const html = printCardHtml(at);

  it("points the card at the wall as it looked, absolutely", () => {
    // Relative image URLs are not resolved by unfurlers.
    expect(html).toContain(`<meta property="og:image" content="${siteUrl}/api/og?at=${at}">`);
    expect(html).toContain(`<meta name="twitter:image" content="${siteUrl}/api/og?at=${at}">`);
    expect(html).toContain(`<meta property="og:url" content="${siteUrl}/print/${at}">`);
  });

  it("declares the rendered image dimensions", () => {
    expect(html).toContain(`<meta property="og:image:width" content="${OG_SIZE.width}">`);
    expect(html).toContain(`<meta property="og:image:height" content="${OG_SIZE.height}">`);
  });

  it("moves a person on to the live wall without a server redirect", () => {
    // A 3xx would carry these tags in a body every unfurler discards.
    expect(html).toContain('<meta http-equiv="refresh" content="0;url=/">');
    expect(html).toContain('<a href="/">');
  });

  it("tells crawlers not to index a print URL", () => {
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
  });

  it("escapes copy into attributes", () => {
    expect(html).toContain("they&#39;re paying right now.");
  });

  it("stays a card and not a document", () => {
    // The page form spent 14KB of app shell to deliver these tags.
    expect(html.length).toBeLessThan(2_000);
  });
});

describe("printPurchaseCardHtml", () => {
  it("points the card at that purchase, not a 30s time bucket", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const paid = printPurchaseCardHtml(id);
    expect(paid).toContain(`<meta property="og:image" content="${siteUrl}/api/og?p=${id}">`);
    expect(paid).toContain(`<meta property="og:url" content="${siteUrl}/print/p/${id}">`);
  });
});
