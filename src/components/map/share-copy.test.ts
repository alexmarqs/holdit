import { describe, expect, it } from "vitest";
import {
  claimShareCopy,
  dilutionShareCopy,
  wallPrintUrl,
  wallShareCopy,
  wallShareUrl,
  wallTweetIntent,
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
      text: "figma.com just took 8.4% of holdit.lol — attention you rent, not own",
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
      text: "figma.com just shrank 10.0% → 8.4% on holdit.lol — hold it or lose it",
    });
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
});
