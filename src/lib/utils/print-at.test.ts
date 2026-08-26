import { describe, expect, it } from "vitest";
import { parsePrintAt } from "./print-at";

const NOW = Date.UTC(2026, 7, 22, 11, 37, 17);
const BUCKET = Date.UTC(2026, 7, 22, 11, 37);
/* Comfortably behind NOW, so an offset within the span cannot trip the skew
   check and turn a bucketing assertion into a future-stamp rejection. */
const PAST = Date.UTC(2026, 7, 22, 10, 0);

describe("parsePrintAt", () => {
  it("reads the unix millisecond the client printed", () => {
    expect(parsePrintAt(String(NOW), NOW)).toBe(BUCKET);
  });

  it("reads an ISO stamp", () => {
    expect(parsePrintAt(new Date(NOW).toISOString(), NOW)).toBe(BUCKET);
  });

  it("rejects a missing or junk value so the card falls back to live", () => {
    expect(parsePrintAt(undefined, NOW)).toBeNull();
    expect(parsePrintAt("nope", NOW)).toBeNull();
  });

  it("rejects a print from the future", () => {
    expect(parsePrintAt(String(NOW + 10 * 60_000), NOW)).toBeNull();
  });

  /*
   * The whole point: `/api/og?at=` renders on a miss, so distinct stamps cost
   * distinct renders. Collapsing a thirty-second span onto one value is what
   * keeps a burst of shares — or a loop over random stamps — on the CDN.
   */
  it("collapses every stamp in a thirty-second span onto one", () => {
    const spread = [0, 1, 1_000, 15_000, 29_999].map((offset) =>
      parsePrintAt(String(PAST + offset), NOW),
    );
    expect(new Set(spread)).toEqual(new Set([PAST]));
  });

  it("starts a new bucket at the next thirty-second mark", () => {
    expect(parsePrintAt(String(PAST + 30_000), NOW)).toBe(PAST + 30_000);
  });

  // Rounding up would name a wall that has not happened, which is exactly what
  // the future check refuses one line earlier.
  it("never rounds a stamp forward past now", () => {
    const at = parsePrintAt(String(NOW), NOW);
    expect(at).not.toBeNull();
    expect(at!).toBeLessThanOrEqual(NOW);
  });

  // A stamp that already sits on the grid is the input the print link carries
  // after the first parse, so parsing it again has to be a no-op.
  it("is idempotent, so a bucketed stamp survives a second parse", () => {
    expect(parsePrintAt(String(BUCKET), NOW)).toBe(BUCKET);
  });
});
