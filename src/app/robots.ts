import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils/env";

/** Special metadata route. Cached unless it reads request-time data. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og", "/print/"],
        /*
         * `/print/` is deliberately absent. robots.txt governs fetching;
         * `noindex` governs indexing, and every print response already sends
         * `x-robots-tag: noindex, follow`. Disallowing the path added no
         * protection — it made that header unreachable, since a crawler that
         * cannot fetch a page cannot read it — while costing the thing print
         * URLs exist for: Twitterbot honours robots.txt, so a disallowed
         * `/print/` never gets fetched, the `og:image` never gets read, and a
         * buyer posting their square gets a bare link with no card.
         */
        disallow: ["/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
