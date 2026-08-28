import type { MapCounters } from "@holdit/core";
import { formatInt, formatMoney, formatShare } from "@/lib/utils/format";

/** The numbers a share is a picture of. */
export type WallCounters = Pick<MapCounters, "squaresLive" | "liveCents">;

/** Caption for the wall being shared — the numbers someone is actually posting. */
export function wallShareCopy(counters: WallCounters): {
  title: string;
  text: string;
} {
  const { squaresLive, liveCents } = counters;
  if (squaresLive === 0) {
    return {
      title: "holdit.lol",
      text: "The wall is empty. $1 is the whole thing until someone else shows up",
    };
  }
  const squares = squaresLive === 1 ? "1 square" : `${formatInt(squaresLive)} squares`;
  return {
    title: "holdit.lol",
    text: `${squares} holding · ${formatMoney(liveCents)} on the wall right now`,
  };
}

/** The post after *your* square lands — occupation, not a census. */
export function claimShareCopy(
  handle: string,
  share: number,
): {
  title: string;
  text: string;
} {
  return {
    title: "holdit.lol",
    text: `${handle} just took ${formatShare(share)} of holdit.lol`,
  };
}

/** The post after somebody else bought and your square got smaller. */
export function dilutionShareCopy(
  handle: string,
  before: number,
  after: number,
): {
  title: string;
  text: string;
} {
  return {
    title: "holdit.lol",
    text: `${handle} just went ${formatShare(before)} → ${formatShare(after)} on holdit.lol`,
  };
}

/*
 * The post body, as opposed to the caption on the card.
 *
 * A bare domain is a link on X, and both halves of "figma.com just took 8.4% of
 * holdit.lol" are bare domains. A post carrying that caption holds three links,
 * and the platform rather than us decides which to unfurl; with a handle of
 * "x.com" that is a coin flip on X's own domain. Naming no domain leaves exactly
 * one URL in the post, so exactly one card can be built from it.
 *
 * Nothing is lost. The handle is on the picture and in the card's `og:title`,
 * where plain text stays plain, and the link itself shows the domain.
 */
export function claimPostText(share: number): string {
  return `Just took ${formatShare(share)} of the wall`;
}

export function dilutionPostText(before: number, after: number): string {
  return `Just went ${formatShare(before)} → ${formatShare(after)} on the wall`;
}

/** Prefills X's composer. The card image is the OG unfurl of `pageUrl`. */
export function tweetIntent(text: string, pageUrl: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${pageUrl}`)}`;
}

export function wallTweetIntent(counters: WallCounters, pageUrl: string): string {
  return tweetIntent(wallShareCopy(counters).text, pageUrl);
}

/** Homepage URL that freezes the OG card at this print, while the page stays live. */
export function wallPrintUrl(origin: string, generatedAt: number): string {
  // Its own path, not a query on the homepage: see `app/print/[at]/route.ts`.
  return new URL(`/print/${generatedAt}`, origin).toString();
}

/** Post-pay share: one purchase, one card, not a 30-second bucket. */
export function purchasePrintUrl(origin: string, purchaseId: string): string {
  return new URL(`/print/p/${purchaseId}`, origin).toString();
}

/**
 * Where a census share should unfurl. An empty print is a blank treemap; the
 * marketing poster is the card until somebody is actually on the wall.
 */
export function wallShareUrl(origin: string, generatedAt: number, squaresLive: number): string {
  if (squaresLive <= 0) return new URL("/", origin).toString();
  return wallPrintUrl(origin, generatedAt);
}

/** Paid banner uses the purchase; the toolbar still uses the time bucket. */
export function sharePageUrl(
  origin: string,
  squaresLive: number,
  stamp: { purchaseId: string } | { at: number },
): string {
  if (squaresLive <= 0) return new URL("/", origin).toString();
  if ("purchaseId" in stamp) return purchasePrintUrl(origin, stamp.purchaseId);
  return wallPrintUrl(origin, stamp.at);
}
