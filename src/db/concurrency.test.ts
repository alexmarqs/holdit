import { buildMapState } from "@holdit/core";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./client";
import { loadMapDataset } from "./queries/dataset";
import { recordPurchase } from "./queries/purchases";
import { resetDatabase } from "./testing";

const T0 = 1_700_000_000_000;

/**
 * Simultaneous buyers. There is no lock, no queue and no version counter here,
 * because position is a share of a sum rather than a slot somebody occupies:
 * two people buying at once cannot conflict, they simply both land and everyone
 * else shrinks. These are the cases where that reasoning has to actually hold.
 */
describe("many buyers at once", () => {
  beforeEach(resetDatabase);

  const wall = async () => buildMapState({ ...(await loadMapDataset(db, T0)), now: T0 });

  it("loses no money when twenty buy in the same instant", async () => {
    const amounts = Array.from({ length: 20 }, (_, i) => 100 + i * 337);
    await Promise.all(
      amounts.map((cents, i) =>
        recordPurchase(
          db,
          { handle: `rush${i}.com`, url: `https://rush${i}.com`, amountCents: cents },
          T0,
        ),
      ),
    );
    const state = await wall();
    const expected = amounts.reduce((a, b) => a + b, 0);
    expect(state.counters.liveCents).toBe(expected);
    expect(state.standings).toHaveLength(20);
    expect(state.standings.reduce((n, s) => n + s.share, 0)).toBeCloseTo(1, 9);
  });

  it("creates one square, not twenty, when they all claim the same domain", async () => {
    await Promise.all(
      Array.from({ length: 20 }, () =>
        recordPurchase(db, { handle: "same.com", url: "https://same.com", amountCents: 500 }, T0),
      ),
    );
    const state = await wall();
    expect(state.standings).toHaveLength(1);
    // Every payment counted — none dropped by the race.
    expect(state.counters.liveCents).toBe(20 * 500);
  });

  it("gives a big and a small buyer exactly their proportions, whoever lands first", async () => {
    await Promise.all([
      recordPurchase(db, { handle: "big.com", url: "https://big.com", amountCents: 90_000 }, T0),
      recordPurchase(
        db,
        { handle: "small.com", url: "https://small.com", amountCents: 10_000 },
        T0,
      ),
    ]);
    const state = await wall();
    const share = (h: string) => state.standings.find((s) => s.holder.handle === h)?.share ?? 0;
    // Two squares: the ceiling is 60%, so 90% renders as 60% and the rest goes
    // to the other square. Both are exact, and they still total the whole wall.
    expect(share("big.com")).toBeCloseTo(0.6, 9);
    expect(share("small.com")).toBeCloseTo(0.4, 9);
    expect(share("big.com") + share("small.com")).toBeCloseTo(1, 9);
  });

  it("is order-independent: the same set of buys gives the same wall", async () => {
    const buys = [4_100, 900, 25_000, 300, 7_700, 1_200];
    const run = async (order: number[]) => {
      await resetDatabase();
      for (const i of order) {
        await recordPurchase(
          db,
          { handle: `o${i}.com`, url: `https://o${i}.com`, amountCents: buys[i]! },
          T0,
        );
      }
      return (await wall()).standings
        .map((s) => `${s.holder.handle}:${s.share.toFixed(12)}`)
        .sort()
        .join("|");
    };
    const forwards = await run([0, 1, 2, 3, 4, 5]);
    const backwards = await run([5, 4, 3, 2, 1, 0]);
    const shuffled = await run([3, 0, 5, 1, 4, 2]);
    expect(backwards).toBe(forwards);
    expect(shuffled).toBe(forwards);
  });
});
