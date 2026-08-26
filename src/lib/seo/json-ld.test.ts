import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION, SITE_NAME } from "./copy";
import { jsonLd, wallGraph } from "./json-ld";

describe("jsonLd", () => {
  it("escapes a tagline that would close the script tag", () => {
    const html = jsonLd({ description: "</script><script>alert(1)" });
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c/script>");
  });
});

describe("wallGraph", () => {
  const state = {
    standings: [
      {
        holder: { handle: "linear.app", url: "https://linear.app", tagline: "Plan and build." },
      },
    ],
  };

  it("uses the same site name and description as the document title", () => {
    const site = wallGraph(state, "https://holdit.lol").find((node) => node["@type"] === "WebSite");
    expect(site).toMatchObject({ name: SITE_NAME, description: SITE_DESCRIPTION });
  });
});
