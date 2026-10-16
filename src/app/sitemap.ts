import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo/metadata";
import { siteUrl } from "@/lib/utils/env";

/** Special metadata route. Cached unless it reads request-time data. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(siteUrl);
}
