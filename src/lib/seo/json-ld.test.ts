import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION, SITE_NAME } from "./copy";
import { jsonLd, wallGraph } from "./json-ld";

describe("jsonLd", () => {
  it("escapes a tagline that would close the script tag", () => {
    const html = jsonLd({ description: "</script><script>alert(1)" });
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c/script>");
  });
});

describe("wallGraph", () => {
  const state = {
    standings: [
      {
        holder: { handle: "linear.app", url: "https://linear.app", tagline: "Plan and build." },
      },
    ],
  };

  it("uses the same site name and description as the document title", () => {
    const site = wallGraph(state, "https://holdit.lol").find((node) => node["@type"] === "WebSite");
    expect(site).toMatchObject({ name: SITE_NAME, description: SITE_DESCRIPTION });
  });

  /*
   * Search Console rejects the Product node without both of these, and it is
   * the one consumer that decides whether the square gets a rich result.
   *
   * The price has to sit on the offer itself. A nested
   * `priceSpecification.price` renders as populated in the Rich Results Test
   * and still fails it — the field it looks for is one level up. Asserting the
   * nested shape is what let that pass here while Search Console reported
   * `price` missing.
   */
  it("gives the square an absolute image and a price Google will read", () => {
    const product = wallGraph(state, "https://holdit.lol").find(
      (node) => node["@type"] === "Product",
    );

    expect(product).toMatchObject({
      image: ["https://holdit.lol/opengraph-image"],
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "1.00",
        priceCurrency: "USD",
      },
    });
  });

  /*
   * A dollar is the floor, not the price: a square is sized by its share of
   * live spend, so any amount above the minimum buys one. `lowPrice` says
   * "from a dollar"; a bare `price` would claim a dollar is what it costs.
   */
  it("prices the square as a floor rather than a fixed amount", () => {
    const product = wallGraph(state, "https://holdit.lol").find(
      (node) => node["@type"] === "Product",
    );
    const offers = (product as { offers: Record<string, unknown> }).offers;

    expect(offers).not.toHaveProperty("price");
    expect(offers).not.toHaveProperty("priceSpecification");
  });
});
