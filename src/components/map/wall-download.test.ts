import { describe, expect, it } from "vitest";
import { PREVIEW_ID, placeWall } from "./place-wall";
import { logoDataUrl, wallCaptureOptions, wallDownloadFilename } from "./wall-download";

describe("wallDownloadFilename", () => {
  it("names the file from the wall's UTC day, not the viewer's clock", () => {
    // 00:30 UTC on the 26th is still the 25th in US Pacific — a local Date
    // would save the wrong day.
    expect(wallDownloadFilename(Date.UTC(2026, 7, 26, 0, 30))).toBe("holdit-2026-08-26.png");
  });
});

describe("placeWall for a download", () => {
  const canvas = { w: 800, h: 400 };
  const standings = [
    { id: "acme", share: 0.6 },
    { id: "other", share: 0.35 },
    { id: "gone", share: 0 },
  ];

  it("packs only real squares — the dashed preview is not in the picture", () => {
    const download = placeWall(standings, canvas);
    expect(download.previewRect).toBeNull();
    expect(download.tiles.map((t) => t.id).sort()).toEqual(["acme", "other"]);
    expect(download.tiles.some((t) => t.id === PREVIEW_ID)).toBe(false);
  });

  it("does not leave a grout hole the size of the ghost", () => {
    const live = placeWall(standings, canvas, 0.05);
    const download = placeWall(standings, canvas);
    const area = (tiles: { w: number; h: number }[]) =>
      tiles.reduce((sum, t) => sum + t.w * t.h, 0);
    expect(area(download.tiles)).toBeGreaterThan(area(live.tiles));
    expect(live.previewRect).not.toBeNull();
  });
});

describe("wall capture logos", () => {
  const TRANSPARENT_GIF = "R0lGODlhAQABAIAAAAAAAP";

  it("does not tell html-to-image to replace favicons with a transparent pixel", () => {
    const options = wallCaptureOptions("#c9d6d3");
    expect(options).not.toHaveProperty("imagePlaceholder");
    expect(options).not.toHaveProperty("onImageErrorHandler");
  });

  it("rasters at 3× so a share is sharper than the on-screen pixels", () => {
    expect(wallCaptureOptions("#c9d6d3").pixelRatio).toBe(3);
  });

  it("keeps a fetched favicon as a data URL so the PNG can paint it", () => {
    const png = new Uint8Array(64).fill(7);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const url = logoDataUrl("linear.app", { bytes: png, contentType: "image/png" });
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url).not.toContain(TRANSPARENT_GIF);
  });

  it("falls back to a monogram, not a hole, when the favicon is missing", () => {
    const url = logoDataUrl("linear.app", null);
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(url)).toContain("LI");
  });
});
