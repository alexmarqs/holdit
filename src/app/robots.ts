import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils/env";

/** Special metadata route. Cached unless it reads request-time data. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og"],
        disallow: ["/api/", "/print/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
