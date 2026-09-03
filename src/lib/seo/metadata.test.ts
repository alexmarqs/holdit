import { describe, expect, it } from "vitest";
import {
  LEGAL_LAST_MODIFIED,
  LEGAL_SLUGS,
  SEARCH_DESCRIPTION,
  SEARCH_TITLE,
  SHARE_DESCRIPTION,
  SHARE_TITLE,
  SITE_NAME,
  WALL_HEADING,
} from "./copy";
import { homeMetadata, leafPage, sitemapEntries } from "./metadata";

describe("leafPage", () => {
  const meta = leafPage({
    title: "Rules",
    description: "How a square works.",
    path: "/rules",
  });

  it("points the share at this page, not the homepage", () => {
    expect(meta.alternates?.canonical).toBe("/rules");
    expect(meta.openGraph?.url).toBe("/rules");
    expect(meta.openGraph?.title).toBe("Rules · holdit.lol");
    expect(meta.openGraph?.description).toBe("How a square works.");
    expect(meta.twitter?.title).toBe("Rules · holdit.lol");
  });
});

describe("the share image", () => {
  /*
   * `app/opengraph-image.tsx` and `app/twitter-image.tsx` supply it, and an
   * explicit `images` here would take precedence over both — sending every
   * unfurler to `/api/og`, which answers 404 without a stamp. So the invariant
   * is an absence, and absences rot silently.
   */
  it("is left to the file conventions on every page", () => {
    expect(homeMetadata.openGraph?.images).toBeUndefined();
    expect(homeMetadata.twitter?.images).toBeUndefined();

    const leaf = leafPage({ title: "Rules", description: "How.", path: "/rules" });
    expect(leaf.openGraph?.images).toBeUndefined();
    expect(leaf.twitter?.images).toBeUndefined();
  });
});

describe("homeMetadata", () => {
  it("gives the tab and the search result the search voice", () => {
    expect(homeMetadata.title).toEqual({ default: SEARCH_TITLE, template: `%s · ${SITE_NAME}` });
    expect(homeMetadata.description).toBe(SEARCH_DESCRIPTION);
  });

  it("gives both share cards the sharing voice, not the search one", () => {
    expect(homeMetadata.openGraph?.title).toBe(SHARE_TITLE);
    expect(homeMetadata.openGraph?.description).toBe(SHARE_DESCRIPTION);
    expect(homeMetadata.twitter?.title).toBe(SHARE_TITLE);
    expect(homeMetadata.twitter?.description).toBe(SHARE_DESCRIPTION);
  });

  /*
   * The widths a result actually renders at. Past them the tail is replaced by
   * an ellipsis, so a title or description that overruns is not merely long —
   * its last clause is unread, and these two strings put the price and the "no
   * auction" claim near the end.
   */
  it("keeps the search title and description inside what a result renders", () => {
    expect(SEARCH_TITLE.length).toBeLessThanOrEqual(60);
    expect(SEARCH_DESCRIPTION.length).toBeLessThanOrEqual(155);
  });

  /*
   * Google prints its own title when the page's h1 shares nothing with the one
   * you wrote, and a rewritten title is `SEARCH_TITLE` paid for and thrown
   * away. Both strings therefore open on the same phrase; reword either so they
   * diverge and this fails rather than the ranking quietly doing so.
   */
  it("opens the h1 and the search title on the same phrase", () => {
    const lead = "Buy a square of ad space";
    expect(SEARCH_TITLE.startsWith(lead)).toBe(true);
    expect(WALL_HEADING.startsWith(lead)).toBe(true);
  });
});

describe("sitemapEntries", () => {
  const rows = sitemapEntries("https://holdit.lol");

  it("lists the homepage and the legal pages, nothing under /print or /api", () => {
    expect(rows.map((row) => row.url)).toEqual([
      "https://holdit.lol",
      "https://holdit.lol/rules",
      "https://holdit.lol/terms",
      "https://holdit.lol/privacy",
    ]);
  });

  it("dates the legal pages and leaves the homepage undated", () => {
    const [home, ...legal] = rows;
    expect(home?.lastModified).toBeUndefined();
    expect(legal.map((row) => row.lastModified)).toEqual(
      LEGAL_SLUGS.map((slug) => LEGAL_LAST_MODIFIED[slug]),
    );
  });

  /*
   * A lastmod of "now" is the failure this guards: it claims the page changed
   * when the crawler asked, which is a fact about the clock and not about the
   * page. Every date here must be a real edit date, so none may be today's.
   */
  it("never stamps a legal page with the current date", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const slug of LEGAL_SLUGS) {
      const date = LEGAL_LAST_MODIFIED[slug];
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(date).not.toBe(today);
    }
  });
});
