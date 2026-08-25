import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;

  it("lets Google fetch the share image, which lives under /api/", () => {
    expect(rule?.allow).toEqual(expect.arrayContaining(["/api/og"]));
  });

  it("keeps payloads and print snapshots out of the crawl", () => {
    expect(rule?.disallow).toEqual(expect.arrayContaining(["/api/", "/print/"]));
  });
});
