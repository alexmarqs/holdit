import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;

  it("lets Google fetch the share image, which lives under /api/", () => {
    expect(rule?.allow).toEqual(expect.arrayContaining(["/api/og"]));
  });

  it("keeps the API payloads out of the crawl", () => {
    expect(rule?.disallow).toEqual(expect.arrayContaining(["/api/"]));
  });

  /*
   * `/print/` must stay fetchable. robots.txt governs fetching; `noindex`
   * governs indexing, and the print responses already send
   * `x-robots-tag: noindex, follow` plus the meta tag — so a disallow adds no
   * protection and makes that header unreachable, since a crawler that cannot
   * fetch the page cannot read it.
   *
   * What it does cost is the whole point of a print URL. Twitterbot honours
   * robots.txt, so a disallowed `/print/` is never fetched, the `og:image` is
   * never read, and a buyer posting their square gets a link with no card.
   */
  it("leaves print snapshots fetchable, because that is how a share unfurls", () => {
    expect(rule?.disallow).not.toEqual(expect.arrayContaining(["/print/"]));
  });
});
