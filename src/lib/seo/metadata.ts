import type { Metadata, Viewport } from "next";
import { WALL_CARD_SIZE } from "@/components/map/wall-card";
import { siteUrl } from "@/lib/utils/env";
import { LEGAL_SLUGS, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_TITLE } from "./copy";

/** The marketing poster. Inner pages must repeat it: Next replaces `openGraph` wholesale. */
export const OG_IMAGE = {
  url: "/api/og",
  width: WALL_CARD_SIZE.width,
  height: WALL_CARD_SIZE.height,
  alt: SITE_TITLE,
} as const;

export const homeMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_TAGLINE,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_TAGLINE,
    images: [OG_IMAGE],
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
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [OG_IMAGE],
    },
  };
}

export function sitemapEntries(
  origin: string,
): { url: string; changeFrequency: "hourly" | "monthly"; priority: number }[] {
  return [
    { url: origin, changeFrequency: "hourly", priority: 1 },
    ...LEGAL_SLUGS.map((path) => ({
      url: `${origin}/${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
