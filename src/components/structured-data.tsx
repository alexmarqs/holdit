import type { MapState } from "@holdit/core";
import { MIN_SPEND_CENTS } from "@holdit/core";
import { siteUrl } from "@holdit/utils/env";

/**
 * JSON-LD as a script body. `<` is escaped so a holder tagline cannot close
 * the tag — `JSON.stringify` does not.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * JSON-LD for the wall.
 *
 * The treemap needs a client-side measurement before it can draw, so a crawler
 * sees no tiles — only the list below it. This states the same facts in a form
 * search engines read directly: what the site is, what a square costs, and who
 * currently holds one.
 */
export function StructuredData({ state }: { state: MapState }) {
  const base = siteUrl;

  const graph = [
    {
      "@type": "WebSite",
      "@id": `${base}#website`,
      url: base,
      name: "holdit.lol",
      description:
        "A wall of everyone paying for attention. Your square's area is your spend as a share of everyone's.",
    },
    {
      "@type": "Product",
      "@id": `${base}#square`,
      name: "A square on the wall",
      description:
        "Display space sized by your share of all live spend. No auction, no bidding, no ranking.",
      offers: {
        "@type": "Offer",
        url: base,
        priceCurrency: "USD",
        // Pay-what-you-want above a floor, which is what PriceSpecification's
        // minPrice is for — a single `price` would misstate it.
        priceSpecification: {
          "@type": "PriceSpecification",
          minPrice: (MIN_SPEND_CENTS / 100).toFixed(2),
          priceCurrency: "USD",
        },
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@type": "ItemList",
      "@id": `${base}#wall`,
      name: "Squares on the wall",
      numberOfItems: state.standings.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: state.standings.slice(0, 25).map((standing, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: standing.holder.handle,
        ...(standing.holder.tagline ? { description: standing.holder.tagline } : {}),
        url: standing.holder.url,
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has no other injection point
      dangerouslySetInnerHTML={{
        __html: jsonLd({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
