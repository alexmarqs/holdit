import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...["rules", "terms", "privacy"].map((path) => ({
      url: `${siteUrl}/${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
