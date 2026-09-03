import { describe, expect, it } from "vitest";
import { OG_SIZE } from "@/components/map/wall-card";
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
  const id = "11111111-1111-4111-8111-111111111111";

  it("points the card at that purchase, not a 30s time bucket", () => {
    const paid = printPurchaseCardHtml(id);
    expect(paid).toContain(`<meta property="og:image" content="${siteUrl}/api/og?p=${id}">`);
    expect(paid).toContain(`<meta property="og:url" content="${siteUrl}/print/p/${id}">`);
  });

  /*
   * The image on a post-pay card names the square and its share; the text beside
   * it used to be the marketing line, so the most personal thing anyone shares
   * unfurled anonymously. X and Slack print that title under the image, which
   * made a buyer's own post read as an advert for the site rather than a claim.
   */
  it("names the square and its share when the purchase is known", () => {
    const paid = printPurchaseCardHtml(id, { handle: "anthropic.com", share: 0.2667 });
    expect(paid).toContain(
      `<meta property="og:title" content="anthropic.com just took 26.67% of holdit.lol">`,
    );
    expect(paid).toContain(
      `<meta name="twitter:title" content="anthropic.com just took 26.67% of holdit.lol">`,
    );
    expect(paid).toContain(`26.67% of holdit.lol`);
  });

  it("describes the picture rather than repeating the claim", () => {
    const paid = printPurchaseCardHtml(id, { handle: "anthropic.com", share: 0.2667 });
    expect(paid).toContain(
      `<meta property="og:image:alt" content="The holdit.lol wall, with anthropic.com holding 26.67%">`,
    );
  });

  it("falls back to the site's own line when the purchase cannot be read", () => {
    const paid = printPurchaseCardHtml(id);
    expect(paid).toContain(`<meta property="og:title" content="holdit.lol — hold your square`);
  });

  it("escapes a handle into the attribute", () => {
    const paid = printPurchaseCardHtml(id, { handle: 'a"b.com', share: 0.1 });
    expect(paid).not.toContain('content="a"b.com');
    expect(paid).toContain("a&quot;b.com");
  });
});
