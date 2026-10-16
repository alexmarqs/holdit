import { describe, expect, it } from "vitest";
import { MAP_CANVAS_FALLBACKS, mapFallbackCss } from "./map-fallback";

describe("map canvas fallbacks", () => {
  it("keeps each layout inside the aspect bucket that shows it", () => {
    let floor = 0;
    for (const fallback of MAP_CANVAS_FALLBACKS) {
      const aspect = fallback.w / fallback.h;
      expect(aspect).toBeGreaterThan(floor);
      if (fallback.maxAspect !== null) expect(aspect).toBeLessThanOrEqual(fallback.maxAspect);
      floor = fallback.maxAspect ?? aspect;
    }
  });

  it("reveals one fallback per bucket", () => {
    const css = mapFallbackCss();
    expect(css).toContain("@container map (aspect-ratio <= 1.48){.map-fit-a{display:block}}");
    expect(css).toContain(
      "@container map (aspect-ratio > 1.72) and (aspect-ratio <= 2.02){.map-fit-c{display:block}}",
    );
    expect(css).toContain("@container map (aspect-ratio > 2.6){.map-fit-e{display:block}}");
  });
});
