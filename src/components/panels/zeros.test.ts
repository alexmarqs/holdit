import {
  buildMapState,
  MIN_SHOWN_CLICKS,
  MIN_SHOWN_TILE_CLICKS,
  MIN_SHOWN_VISITORS,
} from "@holdit/core";
import { describe, expect, it } from "vitest";
import { wallInput } from "../../test/wall";

/**
 * Launch day: real squares, no traffic yet. Nothing that would render a zero
 * should be present in the payload the panels read, so the checks the panels
 * make have something true to check.
 */
describe("a wall with no traffic yet", () => {
  it("reports honest zeros rather than inventing numbers", () => {
    const now = 1_700_000_000_000;
    const state = buildMapState(
      wallInput(
        ["one.com", "two.com", "three.com", "four.com", "five.com"].map((handle) => ({
          handle,
          cents: 2_500,
        })),
        { now },
      ),
    );

    expect(state.counters.squaresLive).toBe(5);
    expect(state.counters.liveCents).toBe(12_500);
    // Everything a visitor would see as "0 …" is genuinely zero here, so the
    // panels' guards are what stands between them and a wall of noughts.
    expect(state.counters.visitorsSinceLaunch).toBe(0);
    expect(state.counters.onlineNow ?? 0).toBe(0);
    expect(state.trending).toHaveLength(0);

    // The wall itself is still fully described.
    expect(state.standings).toHaveLength(5);
    expect(state.standings.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 9);
    // And activity is real, so "Just bought" has something to show from minute one.
    expect(state.activity.length).toBeGreaterThan(0);
  });
});

/**
 * The floors exist so a young wall does not publish a verdict on itself. What
 * matters is that they are floors on *display* only — every figure below them is
 * still counted, and the number shown is always the true one.
 */
describe("the display floors", () => {
  it("sit above the numbers a launch wall will have", () => {
    expect(MIN_SHOWN_CLICKS).toBeGreaterThan(MIN_SHOWN_TILE_CLICKS);
    expect(MIN_SHOWN_VISITORS).toBeGreaterThan(MIN_SHOWN_CLICKS);
  });

  it("never change the counted totals, only whether they are printed", () => {
    const now = 1_700_000_000_000;
    const state = buildMapState(
      wallInput([{ handle: "one.com", cents: 2_500, clicksAllTime: 1 }], { now }),
    );
    // One click is well under every floor, and it is still counted.
    expect(state.counters.clicksAllTime).toBe(1);
    expect(state.standings[0]?.clicksAllTime).toBe(1);
    expect(state.counters.clicksAllTime).toBeLessThan(MIN_SHOWN_CLICKS);
  });
});
