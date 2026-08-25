import { describe, expect, it } from "vitest";
import { jsonLd } from "./structured-data";

describe("jsonLd", () => {
  it("escapes a tagline that would close the script tag", () => {
    const html = jsonLd({ description: "</script><script>alert(1)" });
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c/script>");
  });
});
