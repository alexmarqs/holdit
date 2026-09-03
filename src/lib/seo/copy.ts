export const SITE_NAME = "holdit.lol";

/** The tab title and the blue line in a search result. */
export const SEARCH_TITLE = "Buy a square of ad space from $1 · holdit.lol";

/** The grey lines under it. Under 155 characters, or the end is cut. */
export const SEARCH_DESCRIPTION =
  "Buy ad space on a live wall from $1. Your square is sized by your share of everyone's spend — no auction, no bidding, no leaderboard.";

/**
 * The homepage `h1`. `sr-only`, so it is crawled and read aloud but never seen.
 * Opens on `SEARCH_TITLE`'s phrase on purpose: Google substitutes its own title
 * when the h1 has nothing in common with the one you wrote, and these two had
 * no word in common at all.
 */
export const WALL_HEADING =
  "Buy a square of ad space on holdit.lol — a wall that forgets: new spend takes a slice sized to what they paid";

/** Open Graph and Twitter card title. */
export const SHARE_TITLE = "holdit.lol — hold your square of the wall";

/** Open Graph and Twitter card description. */
export const SHARE_DESCRIPTION =
  "Nobody holds this wall for long. There's always room for the next square.";

/**
 * The long form, for JSON-LD only. Nothing renders it to a human, so it is
 * free to spend the words explaining the mechanism rather than selling.
 */
export const SITE_DESCRIPTION =
  "A wall where $1+ buys a square. Your numeric share follows your live spend; the map compresses the layout so small squares stay visible. Old spend gets cheaper to challenge, and new money takes a slice from everyone. No auction.";

/** Indexed legal pages. The homepage is listed separately — it changes with the wall. */
export const LEGAL_SLUGS = ["rules", "terms", "privacy"] as const;

export const LEGAL_LAST_MODIFIED: Record<(typeof LEGAL_SLUGS)[number], string> = {
  rules: "2026-08-28",
  terms: "2026-08-28",
  privacy: "2026-08-27",
};
