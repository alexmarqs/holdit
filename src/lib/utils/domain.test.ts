import { describe, expect, it } from "vitest";
import { isValidTarget, monogram, normalizeTarget, shortHandle } from "./domain";

describe("normalizeTarget", () => {
  it("collapses the ways people write the same domain into one square", () => {
    const expected = { handle: "linear.app", url: "https://linear.app" };
    for (const input of [
      "linear.app",
      "Linear.app",
      "  linear.app  ",
      "https://linear.app",
      "http://www.linear.app",
      "https://www.linear.app/",
      "linear.app?utm_source=x",
    ]) {
      expect(normalizeTarget(input)).toEqual(expected);
    }
  });

  it("keeps a meaningful path, since that is what was paid for", () => {
    expect(normalizeTarget("crowdreply.io/features/citation-outreach")).toEqual({
      handle: "crowdreply.io",
      url: "https://crowdreply.io/features/citation-outreach",
    });
  });

  it("folds a handle's case, so one profile cannot become two squares", () => {
    /*
     * The regression this guards: the platform reads usernames
     * case-insensitively but `holders_handle_key` does not, so differing case
     * used to buy a second square for the same person — and turned a top-up
     * into a new purchase.
     */
    const canonical = normalizeTarget("@levelsio");
    for (const typed of ["@LevelsIO", "@LEVELSIO", " @LevelsIO "]) {
      expect(normalizeTarget(typed)).toEqual(canonical);
    }
  });

  it("maps an @handle onto x.com while displaying the handle", () => {
    expect(normalizeTarget("@levelsio")).toEqual({
      handle: "@levelsio",
      url: "https://x.com/levelsio",
    });
  });

  it("rejects anything that is not a target", () => {
    for (const input of [
      "",
      "   ",
      "not a domain",
      "localhost",
      "linear",
      "@",
      "@this-is-not-valid!",
      "http://",
    ]) {
      expect(normalizeTarget(input)).toBeNull();
    }
  });

  it("accepts multi-level and long TLDs", () => {
    expect(isValidTarget("storybook.js.org")).toBe(true);
    expect(isValidTarget("scaling.pt")).toBe(true);
    expect(isValidTarget("tinkerer.club")).toBe(true);
  });
});

describe("monogram", () => {
  it("gives the fallback tile two letters", () => {
    expect(monogram("linear.app")).toBe("LI");
    expect(monogram("@levelsio")).toBe("LE");
  });
});

describe("shortHandle", () => {
  it("keeps the part people recognise and drops the rest", () => {
    expect(shortHandle("biomejs.dev")).toBe("biomejs");
    expect(shortHandle("tailwindcss.com")).toBe("tailwindcss");
    expect(shortHandle("storybook.js.org")).toBe("storybook");
  });

  it("leaves an @handle alone — the @ is the recognisable part", () => {
    expect(shortHandle("@levelsio")).toBe("@levelsio");
  });

  it("never returns nothing", () => {
    expect(shortHandle("")).toBe("");
    expect(shortHandle("localhost")).toBe("localhost");
  });
});
