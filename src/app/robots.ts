import { siteUrl } from "@holdit/utils/env";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og"],
        // Payloads stay out. `/api/og` is the exception above: it is og:image.
        // `/print/` is an unbounded snapshot space — noindex on the card is not
        // a crawl budget. Social unfurlers ignore robots.txt.
        disallow: ["/api/", "/print/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
