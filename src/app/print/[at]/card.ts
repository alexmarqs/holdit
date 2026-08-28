import { claimShareCopy } from "@/components/map/share-copy";
import { siteUrl } from "@/lib/utils/env";
import { formatShare } from "@/lib/utils/format";
import { OG_SIZE } from "../../../components/map/og-fonts";

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
/**
 * What a post-pay card says beside its picture.
 *
 * The image already names the square and its share. The text did not, so the
 * most personal link on the site unfurled as an advert for the site — and X and
 * Slack print the title *under* the image, where the buyer's own claim belongs.
 * The wording is `claimShareCopy`, the same sentence the Post-on-X button uses,
 * so a share reads identically wherever it is composed.
 */
function claimCopy(claim: PrintClaim): { title: string; description: string; imageAlt: string } {
  const share = formatShare(claim.share);
  return {
    title: claimShareCopy(claim.handle, claim.share).text,
    description: `${claim.handle} holds ${share} of the wall. Live spend fades; the picture is this moment.`,
    imageAlt: `The holdit.lol wall, with ${claim.handle} holding ${share}`,
  };
}

/** The square a post-pay card belongs to, when the purchase could be read. */
export interface PrintClaim {
  handle: string;
  share: number;
}

function printCardDocument(canonicalPath: string, imageUrl: string, claim?: PrintClaim): string {
  const copy = claim ? claimCopy(claim) : null;
  const title = copy?.title ?? TITLE;
  const description = copy?.description ?? DESCRIPTION;
  const imageAlt = copy?.imageAlt ?? IMAGE_ALT;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=/">
<title>${attr(title)}</title>
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="holdit.lol">
<meta property="og:url" content="${attr(`${siteUrl}${canonicalPath}`)}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:image" content="${attr(imageUrl)}">
<meta property="og:image:width" content="${OG_SIZE.width}">
<meta property="og:image:height" content="${OG_SIZE.height}">
<meta property="og:image:alt" content="${attr(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="twitter:image" content="${attr(imageUrl)}">
<meta name="twitter:image:alt" content="${attr(imageAlt)}">
</head>
<body><a href="/">holdit.lol — the live wall</a></body>
</html>
`;
}

export function printCardHtml(at: number): string {
  return printCardDocument(`/print/${at}`, `${siteUrl}/api/og?at=${at}`);
}

export function printPurchaseCardHtml(purchaseId: string, claim?: PrintClaim): string {
  return printCardDocument(`/print/p/${purchaseId}`, `${siteUrl}/api/og?p=${purchaseId}`, claim);
}
