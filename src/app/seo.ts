import type { Metadata } from "next";
import { WALL_CARD_SIZE } from "../components/map/wall-card";

/** The marketing poster. Inner pages must repeat it: Next replaces `openGraph` wholesale. */
export const OG_IMAGE = {
  url: "/api/og",
  width: WALL_CARD_SIZE.width,
  height: WALL_CARD_SIZE.height,
  alt: "holdit.lol — hold your square of the wall",
} as const;

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
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: "holdit.lol",
      title: `${title} · holdit.lol`,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}
