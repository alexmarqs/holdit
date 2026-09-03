import { MIN_SPEND_CENTS } from "@holdit/core";
import { siteUrl } from "@/lib/utils/env";
import { SITE_DESCRIPTION, SITE_NAME } from "./copy";

type WallListing = {
  standings: readonly {
    holder: { handle: string; url: string; tagline: string | null };
  }[];
};

/**
 * JSON-LD as a script body. `<` is escaped so a holder tagline cannot close
 * the tag — `JSON.stringify` does not.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function wallGraph(state: WallListing, base = siteUrl) {
  return [
    {
      "@type": "WebSite",
      "@id": `${base}#website`,
      url: base,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "Product",
      "@id": `${base}#square`,
      name: "A square on the wall",
      description:
        "Display space sized by your share of all live spend. No auction, no bidding, no ranking.",
      image: [`${base}/opengraph-image`],
      brand: { "@type": "Brand", name: SITE_NAME },
      offers: {
        "@type": "AggregateOffer",
        url: base,
        lowPrice: (MIN_SPEND_CENTS / 100).toFixed(2),
        priceCurrency: "USD",
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
}
