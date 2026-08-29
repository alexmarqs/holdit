import { describe, expect, it } from "vitest";
import {
  claimPostText,
  claimShareCopy,
  dilutionPostText,
  dilutionShareCopy,
  prefersXApp,
  purchasePrintUrl,
  sharePageUrl,
  tweetAppIntent,
  wallPrintUrl,
  wallShareCopy,
  wallShareUrl,
  wallTweetIntent,
  xShareWebFallback,
} from "./share-copy";

const LIVE = { squaresLive: 115, liveCents: 1_240_000 };

describe("wallShareCopy", () => {
  it("states the live wall in a postable line", () => {
    expect(wallShareCopy(LIVE)).toEqual({
      title: "holdit.lol",
      text: "115 squares holding · $12,400 on the wall right now",
    });
  });

  it("singularises a lonely square", () => {
    expect(wallShareCopy({ squaresLive: 1, liveCents: 100 }).text).toBe(
      "1 square holding · $1 on the wall right now",
    );
  });

  it("does not census an empty wall as zero squares holding nothing", () => {
    expect(wallShareCopy({ squaresLive: 0, liveCents: 0 }).text).toBe(
      "The wall is empty. $1 is the whole thing until someone else shows up",
    );
  });
});

describe("claimShareCopy", () => {
  it("posts the square you just took, not the wall's census", () => {
    expect(claimShareCopy("figma.com", 0.084)).toEqual({
      title: "holdit.lol",
      text: "figma.com just took 8.4% of holdit.lol",
    });
  });

  it("keeps an @handle as written", () => {
    expect(claimShareCopy("@holdit", 0.1).text.startsWith("@holdit just took")).toBe(true);
  });
});

describe("dilutionShareCopy", () => {
  it("posts the shrink, not a census", () => {
    expect(dilutionShareCopy("figma.com", 0.1, 0.084)).toEqual({
      title: "holdit.lol",
      text: "figma.com just went 10.0% → 8.4% on holdit.lol",
    });
  });
});

/*
 * What goes in the post body, as opposed to the card.
 *
 * X linkifies a bare domain, and both halves of "figma.com just took 8.4% of
 * holdit.lol" are bare domains — so a post carrying that caption holds three
 * links and the platform, not us, decides which one to unfurl. With a handle of
 * "x.com" that is a coin flip on X's own domain.
 *
 * The card is where the handle belongs: `og:title` is plain text and stays
 * plain. The body names no domain at all, so exactly one URL is present and
 * exactly one card can be built from it.
 */
describe("post bodies carry no bare domain", () => {
  const DOMAIN = /\b[a-z0-9-]+\.(?:com|lol|app|cloud|io|dev|net|org)\b/i;

  it("states the claim without naming a domain", () => {
    expect(claimPostText(0.3889)).toBe("Just took 38.89% of the wall");
    expect(claimPostText(0.3889)).not.toMatch(DOMAIN);
  });

  it("states the shrink without naming a domain", () => {
    expect(dilutionPostText(0.1, 0.084)).toBe("Just went 10.0% → 8.4% on the wall");
    expect(dilutionPostText(0.1, 0.084)).not.toMatch(DOMAIN);
  });

  it("leaves the wall census alone, which never named one", () => {
    expect(wallShareCopy({ squaresLive: 6, liveCents: 93_700 }).text).not.toMatch(DOMAIN);
    expect(wallShareCopy({ squaresLive: 0, liveCents: 0 }).text).not.toMatch(DOMAIN);
  });

  it("keeps the handle on the card, where plain text stays plain", () => {
    expect(claimShareCopy("x.com", 0.3889).text).toContain("x.com");
  });
});

describe("wallTweetIntent", () => {
  it("opens X with the caption and the wall URL", () => {
    const href = wallTweetIntent(LIVE, "https://holdit.lol/");
    expect(href.startsWith("https://x.com/intent/post?text=")).toBe(true);
    const text = decodeURIComponent(new URL(href).searchParams.get("text") ?? "");
    expect(text).toBe("115 squares holding · $12,400 on the wall right now\nhttps://holdit.lol/");
  });
});

describe("tweetAppIntent", () => {
  it("addresses the X app, not a generic share", () => {
    const href = tweetAppIntent(
      "115 squares holding · $12,400 on the wall right now",
      "https://holdit.lol/",
    );
    expect(href.startsWith("twitter://post?message=")).toBe(true);
    expect(href).not.toContain("x.com/intent");
    const text = decodeURIComponent(href.slice("twitter://post?message=".length));
    expect(text).toBe("115 squares holding · $12,400 on the wall right now\nhttps://holdit.lol/");
  });

  it("carries the same caption the web intent would have posted", () => {
    const text = wallShareCopy(LIVE).text;
    const page = "https://holdit.lol/print/1";
    const web = decodeURIComponent(
      new URL(wallTweetIntent(LIVE, page)).searchParams.get("text") ?? "",
    );
    const app = decodeURIComponent(
      tweetAppIntent(text, page).slice("twitter://post?message=".length),
    );
    expect(app).toBe(web);
  });
});

describe("prefersXApp", () => {
  it("hands a phone to the X app", () => {
    expect(
      prefersXApp({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      }),
    ).toBe(true);
    expect(
      prefersXApp({
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0",
      }),
    ).toBe(true);
  });

  it("leaves a desktop on the web intent", () => {
    expect(
      prefersXApp({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      }),
    ).toBe(false);
  });

  it("treats iPadOS Safari as a phone even though it claims to be a Mac", () => {
    expect(
      prefersXApp({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });
});

describe("xShareWebFallback", () => {
  const iphone = {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  };
  const android = {
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0",
  };
  const ipadOs = {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    maxTouchPoints: 5,
  };

  it("does not open x.com after a successful iPhone hand-off", () => {
    expect(xShareWebFallback(iphone)).toBe(false);
    expect(xShareWebFallback(ipadOs)).toBe(false);
  });

  it("still falls back to the website on Android, which can see the page hide", () => {
    expect(xShareWebFallback(android)).toBe(true);
  });
});

describe("wallPrintUrl", () => {
  it("pins the tweet to the print, not the live homepage", () => {
    const at = Date.UTC(2026, 7, 22, 11, 37);
    expect(wallPrintUrl("https://holdit.lol", at)).toBe(`https://holdit.lol/print/${at}`);
  });

  it("unfurls an empty wall as the poster, not a blank print", () => {
    const at = Date.UTC(2026, 7, 22, 11, 37);
    expect(wallShareUrl("https://holdit.lol", at, 0)).toBe("https://holdit.lol/");
    expect(wallShareUrl("https://holdit.lol", at, 3)).toBe(`https://holdit.lol/print/${at}`);
  });

  it("pins a paid share to that purchase, not the 30s bucket", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(purchasePrintUrl("https://holdit.lol", id)).toBe(`https://holdit.lol/print/p/${id}`);
    expect(sharePageUrl("https://holdit.lol", 5, { purchaseId: id })).toBe(
      `https://holdit.lol/print/p/${id}`,
    );
    expect(sharePageUrl("https://holdit.lol", 5, { at: Date.UTC(2026, 7, 22, 11, 37) })).toContain(
      "/print/",
    );
  });
});
