import { siteUrl } from "@/lib/utils/env";
import { WALL_CARD_SIZE } from "../../../components/map/wall-card";

const TITLE = "holdit.lol — hold your square of the wall";
const DESCRIPTION = "Everyone paying for attention, sized by how much they're paying right now.";
const IMAGE_ALT = "holdit.lol — everyone paying for attention, sized by how much";

/** Attribute values, so a stray quote in the copy cannot close the tag. */
function attr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The document a shared print URL answers with.
 *
 * Every consumer of this page is a machine reading `og:` tags — Twitter, Slack,
 * Discord, iMessage — so the response is the tags and nothing else. It used to
 * be a React page whose body called `redirect("/")`, which looked right and was
 * not: the tags came back inside the body of a 307, and every unfurler follows
 * the redirect and reads the homepage card instead. The whole point of a print
 * link is the wall as it looked, so the snapshot has to arrive as a 200.
 *
 * The human is moved on by the refresh, not by the server. Unfurlers do not run
 * it, which is exactly why it can be here.
 *
 * Absolute URLs throughout: an unfurler will not resolve a relative `og:image`.
 */
export function printCardHtml(at: number): string {
  const image = `${siteUrl}/api/og?at=${at}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=/">
<title>${attr(TITLE)}</title>
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="holdit.lol">
<meta property="og:url" content="${siteUrl}/print/${at}">
<meta property="og:title" content="${attr(TITLE)}">
<meta property="og:description" content="${attr(DESCRIPTION)}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="${WALL_CARD_SIZE.width}">
<meta property="og:image:height" content="${WALL_CARD_SIZE.height}">
<meta property="og:image:alt" content="${attr(IMAGE_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="holdit.lol">
<meta name="twitter:description" content="${attr(DESCRIPTION)}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:alt" content="${attr(IMAGE_ALT)}">
</head>
<body><a href="/">holdit.lol — the live wall</a></body>
</html>
`;
}
