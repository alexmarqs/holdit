import { describe, expect, it } from "vitest";
import { mapPreviewActive } from "./preview";

const live = {
  wantPreview: true,
  amountCents: 100,
  fullscreen: false,
  empty: false,
};

describe("mapPreviewActive", () => {
  it("is on for a visitor with an amount, until they turn it off", () => {
    expect(mapPreviewActive(live)).toBe(true);
  });

  it("restores the live wall when the switch is off", () => {
    expect(mapPreviewActive({ ...live, wantPreview: false })).toBe(false);
  });

  it("stays off in fullscreen even if the switch is on", () => {
    expect(mapPreviewActive({ ...live, fullscreen: true })).toBe(false);
  });

  it("does not draw a ghost when there is no amount to preview", () => {
    expect(mapPreviewActive({ ...live, amountCents: null })).toBe(false);
  });

  it("keeps the founding square on even if the switch was left off", () => {
    expect(mapPreviewActive({ ...live, wantPreview: false, empty: true })).toBe(true);
  });

  it("keeps the founding square in fullscreen — it is the map", () => {
    expect(mapPreviewActive({ ...live, fullscreen: true, empty: true })).toBe(true);
  });
});
