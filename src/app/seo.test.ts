import { describe, expect, it } from "vitest";
import { leafPage } from "./seo";

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
  });
});
