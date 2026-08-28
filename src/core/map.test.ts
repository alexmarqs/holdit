import { describe, expect, it } from "vitest";
import { MS_PER_DAY } from "./config";
import { buildMapState } from "./map";
import type { Holder, Purchase } from "./types";

const NOW = Date.UTC(2026, 7, 21);
const daysAgo = (d: number) => NOW - d * MS_PER_DAY;

const holder = (id: string): Holder => ({
  id,
  handle: `${id}.dev`,
  url: `https://${id}.dev`,
  tagline: `${id} does a thing.`,
  createdAt: daysAgo(30),
});

const buy = (holderId: string, amountCents: number, ageDays = 0): Purchase => ({
  id: `${holderId}-${amountCents}-${ageDays}`,
  holderId,
  amountCents,
  createdAt: daysAgo(ageDays),
  refundedAt: null,
});

/** Enough background squares that the 10% ceiling is live but non-binding. */
const filler = (n: number, cents = 10_000): [string, number][] =>
  Array.from({ length: n }, (_, i) => [`f${i}`, cents]);

function scenario(
  rows: [string, number, number?][],
  extra: Partial<Parameters<typeof buildMapState>[0]> = {},
) {
  const holders = rows.map(([id]) => holder(id));
  const purchasesByHolder = new Map(
    rows.map(([id, cents, age]) => [id, [buy(id, cents, age ?? 0)]] as const),
  );
  return buildMapState({ holders, purchasesByHolder, now: NOW, ...extra });
}

describe("buildMapState", () => {
  it("handles an empty map without dividing by zero", () => {
    const state = buildMapState({ holders: [], purchasesByHolder: new Map(), now: NOW });
    expect(state.standings).toEqual([]);
    expect(state.counters.liveCents).toBe(0);
    expect(state.counters.squaresLive).toBe(0);
    expect(state.counters.onlineNow).toBeNull();
  });

  it("sorts standings by share, largest first", () => {
    const state = scenario([["a", 10_000], ["b", 90_000], ["c", 40_000], ...filler(200, 8_000)]);
    const shares = state.standings.map((s) => s.share);
    expect([...shares].sort((x, y) => y - x)).toEqual(shares);
    expect(state.standings[0]?.holder.id).toBe("b");
  });

  it("dilutes everyone else when one square buys — the whole loop", () => {
    const rows = filler(200);
    const before = scenario(rows);
    const after = scenario([...rows, ["newcomer", 50_000]]);
    const shareOf = (state: ReturnType<typeof scenario>, id: string) =>
      state.standings.find((s) => s.holder.id === id)?.share ?? 0;

    for (const [id] of rows) expect(shareOf(after, id)).toBeLessThan(shareOf(before, id));
  });

  it("counts live spend as real money, not a list price", () => {
    // A single $50 purchase made moments ago is worth exactly $50.
    expect(scenario([["a", 5_000]]).counters.liveCents).toBeCloseTo(5_000, 6);
  });

  it("keeps all-time spend intact while live spend fades", () => {
    const state = scenario([["old", 100_000, 42], ["new", 100_000, 0], ...filler(200)]);
    const old = state.standings.find((s) => s.holder.id === "old")!;
    const fresh = state.standings.find((s) => s.holder.id === "new")!;

    expect(old.allTimeCents).toBe(fresh.allTimeCents);
    expect(old.liveCents).toBeLessThan(fresh.liveCents);
    expect(old.share).toBeLessThan(fresh.share);
  });

  it("records the last purchase for the warmth channel", () => {
    const state = buildMapState({
      holders: [holder("a")],
      purchasesByHolder: new Map([["a", [buy("a", 10_000, 10), buy("a", 5_000, 2)]]]),
      now: NOW,
    });
    expect(state.standings[0]?.lastPurchaseAt).toBe(daysAgo(2));
    expect(state.standings[0]?.lastPurchaseId).toBe("a-5000-2");
  });

  it("applies a share floor once a canvas area is known", () => {
    const rows: [string, number][] = [["whale", 50_000_000], ["dust", 1], ...filler(200)];
    const dust = (state: ReturnType<typeof scenario>) =>
      state.standings.find((s) => s.holder.id === "dust")?.share ?? 0;
    expect(dust(scenario(rows, { mapArea: 880 * 560 }))).toBeGreaterThan(dust(scenario(rows)));
  });

  it("reports which squares were clamped, so the UI can say so", () => {
    const state = scenario([["whale", 100_000_000], ["dust", 1], ...filler(200)], {
      mapArea: 880 * 560,
    });
    expect(state.standings.find((s) => s.holder.id === "whale")?.capped).toBe(true);
    expect(state.standings.find((s) => s.holder.id === "dust")?.floored).toBe(true);
    expect(state.standings.find((s) => s.holder.id === "f5")?.capped).toBe(false);
  });

  it("ranks trending by clicks per hour, not by size", () => {
    const state = scenario([["big", 500_000], ["small", 10_000], ...filler(200)], {
      clicksLastHourByHolder: new Map([
        ["big", 3],
        ["small", 400],
      ]),
    });
    expect(state.trending[0]?.handle).toBe("small.dev");
    expect(state.trending).toHaveLength(2);
  });

  it("totals clicks across every square", () => {
    const state = scenario(
      [
        ["a", 10_000],
        ["b", 10_000],
      ],
      {
        clicksAllTimeByHolder: new Map([
          ["a", 120],
          ["b", 30],
        ]),
      },
    );
    expect(state.counters.clicksAllTime).toBe(150);
  });

  it("returns the newest activity first and caps the feed", () => {
    const activity = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      handle: `h${i}.dev`,
      kind: "topped_up" as const,
      amountCents: 5_000,
      shareBefore: 0.01,
      shareAfter: 0.02,
      at: NOW - i * 60_000,
    }));
    const state = scenario([["a", 10_000]], { activity });
    expect(state.activity).toHaveLength(12);
    expect(state.activity[0]?.id).toBe("e0");
  });

  it("passes presence straight through", () => {
    expect(scenario([["a", 10_000]], { onlineNow: 42 }).counters.onlineNow).toBe(42);
  });

  it("reconstructs the wall as of a print, ignoring later buys", () => {
    const early = buy("a", 90_000, 0);
    const late = { ...buy("b", 90_000, 0), createdAt: NOW + 60_000 };
    const input = {
      holders: [holder("a"), holder("b")],
      purchasesByHolder: new Map([
        ["a", [early]],
        ["b", [late]],
      ]),
      now: NOW,
    };
    const printed = buildMapState(input);
    const after = buildMapState({ ...input, now: NOW + 60_000 });

    expect(printed.standings.find((s) => s.holder.id === "b")?.liveCents).toBe(0);
    expect(after.standings.find((s) => s.holder.id === "b")?.liveCents).toBeGreaterThan(0);
    expect(printed.counters.squaresLive).toBe(1);
    expect(after.counters.squaresLive).toBe(2);
  });
});
