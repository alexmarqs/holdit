import type { Metadata, Viewport } from "next";
import { siteUrl } from "@/lib/utils/env";
import {
  LEGAL_LAST_MODIFIED,
  LEGAL_SLUGS,
  SEARCH_DESCRIPTION,
  SEARCH_TITLE,
  SHARE_DESCRIPTION,
  SHARE_TITLE,
  SITE_NAME,
} from "./copy";

/*
 * No `images` anywhere below, on purpose. `app/opengraph-image.tsx` and
 * `app/twitter-image.tsx` supply the card, and an explicit `images` here would
 * take precedence over them — pointing every unfurler at `/api/og`, which now
 * answers 404 without a stamp.
 */
export const homeMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SEARCH_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SEARCH_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const homeViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f8f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1615" },
  ],
};

/**
 * Metadata for /rules, /terms, /privacy.
 *
 * Setting only `canonical` left Open Graph inherited from the layout, so a
 * shared /rules link unfurled as the homepage.
 */
export function leafPage({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: `/${string}`;
}): Metadata {
  const shareTitle = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: SITE_NAME,
      title: shareTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
    },
  };
}

type SitemapEntry = {
  url: string;
  lastModified?: string;
  changeFrequency: "hourly" | "monthly";
  priority: number;
};

export function sitemapEntries(origin: string): SitemapEntry[] {
  return [
    { url: origin, changeFrequency: "hourly", priority: 1 },
    ...LEGAL_SLUGS.map((path) => ({
      url: `${origin}/${path}`,
      lastModified: LEGAL_LAST_MODIFIED[path],
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
