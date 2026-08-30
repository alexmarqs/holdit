import { describe, expect, it } from "vitest";
import { isSpineTile, previewContent, tileContent, widthForLabel } from "./detail";

const labels = (full: string, tagline: string | null = "A short line about the product.") => ({
  full,
  short: full.split(".")[0] ?? full,
  stats: "10.0% · 1,234 clicks",
  tagline,
});

describe("tileContent", () => {
  it("always renders a mark, even below the logo gate", () => {
    const face = tileContent(22, 12, labels("folk.app"));
    expect(face.logoPx).toBeGreaterThanOrEqual(13);
    expect(face.name).toBeNull();
  });

  it("shows the whole handle when it fits", () => {
    const face = tileContent(240, 180, labels("linear.app"));
    expect(face.name).toBe("linear.app");
    expect(face.nameClipped).toBe(false);
    expect(face.taglineLines).toBe(3);
  });

  it("shrinks the type before dropping to the short form", () => {
    // 130px holds "tailwindcss.com" at 13px (=132 > 130 fails) but not at 16px.
    const face = tileContent(150, 70, labels("tailwindcss.com"));
    expect(face.name).not.toBeNull();
    expect(face.nameFontPx).toBeLessThanOrEqual(16);
    expect(widthForLabel(face.name!, face.nameFontPx)).toBeLessThanOrEqual(150);
  });

  it("falls back to the short form rather than clipping", () => {
    const face = tileContent(100, 97, labels("tailwindcss.com"));
    expect(face.name).toBe("tailwindcss");
    expect(face.nameClipped).toBe(false);
  });

  /*
   * The regression that motivated this design: tailwindcss.com needed 105px for
   * its own name, had 100px, and the old ladder dropped it to logo-only — then
   * the coherence ceiling silenced the six smaller squares below it too.
   */
  it("never silences a square that has room for a name", () => {
    for (const [w, h, handle] of [
      [100, 97, "tailwindcss.com"],
      [101, 93, "upstash.com"],
      [101, 76, "zed.dev"],
      [78, 84, "inngest.com"],
    ] as const) {
      expect(tileContent(w, h, labels(handle)).name, handle).not.toBeNull();
    }
  });

  it("clips only when no size and no form fits across", () => {
    const face = tileContent(58, 70, labels("cleanshot.com"));
    expect(face.name).toBe("cleanshot");
    expect(face.nameClipped).toBe(true);
  });

  /*
   * The bug this gate exists for: width fitted, height did not, and the name
   * was drawn half off the bottom edge. A clipped ellipsis is readable; a name
   * sliced through the middle of its letters is not, so this drops it instead.
   */
  it("drops the name when the line box will not fit under the logo", () => {
    const face = tileContent(58, 32, labels("cleanshot.com"));
    expect(face.name).toBeNull();
    expect(face.logoPx).toBeGreaterThanOrEqual(12);
  });

  it("shrinks the mark to keep a name rather than the other way round", () => {
    const tight = tileContent(120, 52, labels("dub.co"));
    expect(tight.name).toBe("dub.co");
    expect(tight.logoPx).toBeLessThan(16);
  });

  it("gates stats and tagline independently of each other", () => {
    // Wide and shallow: room for a name, not for the rows beneath it.
    const flat = tileContent(400, 50, labels("stripe.com"));
    expect(flat.name).toBe("stripe.com");
    expect(flat.stats).toBe(false);
    expect(flat.taglineLines).toBe(0);
  });

  it("writes the handle down a narrow column", () => {
    const face = tileContent(30, 120, labels("vercel.com"));
    expect(face.spine).toBe(true);
    expect(face.name).toBe("vercel.com");
  });
});

describe("isSpineTile", () => {
  it("takes tall narrow columns and not squat ones", () => {
    expect(isSpineTile(30, 120)).toBe(true);
    expect(isSpineTile(60, 70)).toBe(false);
    expect(isSpineTile(120, 300)).toBe(false);
  });
});

/*
 * The rows under the name have to fit too. Before this, a tile could clear the
 * name gate and then have its wrapped stat line pushed through the bottom edge,
 * slicing the name in half — visible on astro, trigger and zed.dev.
 */
describe("the rows under the name", () => {
  it("drops the stat line when it would not fit", () => {
    // Room for logo + name and nothing else.
    const face = tileContent(140, 58, labels("astro.build"));
    expect(face.name).not.toBeNull();
    expect(face.stats).toBe(false);
    expect(face.taglineLines).toBe(0);
  });

  it("keeps the stat line when there is room for it", () => {
    const face = tileContent(200, 110, labels("astro.build"));
    expect(face.stats).toBe(true);
  });

  it("counts a wrapped stat line as two lines, not one", () => {
    const narrow = tileContent(110, 92, {
      ...labels("bun.sh"),
      stats: "1.9% · 1,333 clicks",
    });
    const wide = tileContent(260, 92, { ...labels("bun.sh"), stats: "1.9% · 1,333 clicks" });
    // Same height, but only the wide tile prints the stats on one line.
    expect(wide.stats).toBe(true);
    expect(narrow.stats).toBe(false);
  });

  it("shows no tagline when there is no tagline to show", () => {
    expect(tileContent(320, 260, labels("linear.app", null)).taglineLines).toBe(0);
  });

  it("uses all three tagline lines when they fit", () => {
    expect(tileContent(320, 260, labels("linear.app")).taglineLines).toBe(3);
  });

  it("shows one tagline line instead of rejecting a tile below the old size gate", () => {
    const face = tileContent(140, 112, {
      ...labels("linear.app"),
      stats: "12.0%",
    });
    expect(face.taglineLines).toBe(1);
  });

  it("does not reserve a blank stats row when preview mode omits it", () => {
    const face = tileContent(110, 80, {
      ...labels("linear.app"),
      stats: undefined,
    });
    expect(face.stats).toBe(false);
    expect(face.taglineLines).toBe(1);
  });
});

describe("previewContent", () => {
  /*
   * The size the default $10 preview actually gets on a 45-square wall,
   * measured in the browser: 69.51 x 61.77. The old flat 74px width gate drew
   * nothing at all here.
   */
  it("states the share in the box the default amount actually gets", () => {
    const content = previewContent(69.51, 61.77, "0.39%", "for $10");
    expect(content.sharePx).toBe(15);
    expect(content.price).toBe(true);
    // 'your square' needs 85px at 10px type; this box has 69.
    expect(content.caption).toBe(false);
  });

  it("gives the share the room before the caption gets any", () => {
    // Wide enough for every line, tall enough for only two of them.
    const content = previewContent(240, 40, "5.0%", "for $136");
    expect(content.sharePx).toBe(22);
    expect(content.price).toBe(false);
    expect(content.caption).toBe(false);
  });

  it("shows all three lines once there is room", () => {
    const content = previewContent(240, 120, "5.0%", "for $136");
    expect(content.sharePx).toBe(22);
    expect(content.price).toBe(true);
    expect(content.caption).toBe(true);
  });

  it("steps the type down rather than dropping the number", () => {
    const roomy = previewContent(120, 60, "0.39%", "for $10");
    const cramped = previewContent(70, 60, "0.39%", "for $10");
    expect(roomy.sharePx).not.toBeNull();
    expect(cramped.sharePx).not.toBeNull();
    expect(cramped.sharePx!).toBeLessThan(roomy.sharePx!);
  });

  it("draws nothing when not even the smallest step fits", () => {
    expect(previewContent(30, 30, "0.39%", "for $10").sharePx).toBeNull();
  });

  it("measures the caption it is given, so a founding square can say Yours", () => {
    // 'your square' fits at 90px; a longer founding line does not.
    expect(previewContent(90, 200, "100%", "for $1").caption).toBe(true);
    expect(
      previewContent(90, 200, "100%", "until the next square", "until somebody else shows up")
        .caption,
    ).toBe(false);
  });
});
