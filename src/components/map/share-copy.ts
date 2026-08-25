import type { MapCounters } from "@holdit/core";
import { formatInt, formatMoney, formatShare } from "@holdit/utils/format";

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
    text: `${handle} just took ${formatShare(share)} of holdit.lol — attention you rent, not own`,
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
    text: `${handle} just shrank ${formatShare(before)} → ${formatShare(after)} on holdit.lol — hold it or lose it`,
  };
}

/** Prefills X's composer. The card image is the OG unfurl of `pageUrl`. */
export function tweetIntent(text: string, pageUrl: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${pageUrl}`)}`;
}

export function wallTweetIntent(counters: WallCounters, pageUrl: string): string {
  return tweetIntent(wallShareCopy(counters).text, pageUrl);
}

/** Homepage URL that freezes the OG card at this print, while the page stays live. */
export function wallPrintUrl(origin: string, generatedAt: number, proof?: string | null): string {
  // Its own path, not a query on the homepage: see `app/print/[at]/route.ts`.
  const url = new URL(`/print/${generatedAt}`, origin);
  if (proof) url.searchParams.set("p", proof);
  return url.toString();
}

/**
 * Where a census share should unfurl. An empty print is a blank treemap; the
 * marketing poster is the card until somebody is actually on the wall.
 */
export function wallShareUrl(
  origin: string,
  generatedAt: number,
  squaresLive: number,
  proof?: string | null,
): string {
  if (squaresLive <= 0) return new URL("/", origin).toString();
  return wallPrintUrl(origin, generatedAt, proof);
}
