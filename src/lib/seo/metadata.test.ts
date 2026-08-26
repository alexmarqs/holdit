import { describe, expect, it } from "vitest";
import { SITE_NAME, SITE_TITLE } from "./copy";
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

describe("homeMetadata", () => {
  it("keeps the tab title, Open Graph, and Twitter card on the same name", () => {
    expect(homeMetadata.title).toEqual({ default: SITE_TITLE, template: `%s · ${SITE_NAME}` });
    expect(homeMetadata.openGraph?.title).toBe(SITE_TITLE);
    expect(homeMetadata.twitter?.title).toBe(SITE_TITLE);
  });
});

describe("sitemapEntries", () => {
  const urls = sitemapEntries("https://holdit.lol").map((row) => row.url);

  it("lists the homepage and the legal pages, nothing under /print or /api", () => {
    expect(urls).toEqual([
      "https://holdit.lol",
      "https://holdit.lol/rules",
      "https://holdit.lol/terms",
      "https://holdit.lol/privacy",
    ]);
  });
});
