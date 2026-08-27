import { describe, expect, it } from "vitest";
import { mapPreviewActive } from "./preview";

describe("mapPreviewActive", () => {
  it("is on for a visitor with an amount, until they turn it off", () => {
    expect(mapPreviewActive({ wantPreview: true, amountCents: 100, fullscreen: false })).toBe(true);
  });

  it("restores the live wall when the switch is off", () => {
    expect(mapPreviewActive({ wantPreview: false, amountCents: 100, fullscreen: false })).toBe(
      false,
    );
  });

  it("stays off in fullscreen even if the switch is on", () => {
    expect(mapPreviewActive({ wantPreview: true, amountCents: 100, fullscreen: true })).toBe(false);
  });

  it("does not draw a ghost when there is no amount to preview", () => {
    expect(mapPreviewActive({ wantPreview: true, amountCents: null, fullscreen: false })).toBe(
      false,
    );
  });
});
