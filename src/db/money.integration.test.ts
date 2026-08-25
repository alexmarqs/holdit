import {
  buildMapState,
  ceilingFor,
  clampSpend,
  HALF_LIFE_DAYS,
  MIN_SPEND_CENTS,
  MS_PER_DAY,
  shareAfterSpend,
} from "@holdit/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./client";
import { loadMapDataset } from "./queries/dataset";
import { recordPurchase } from "./queries/purchases";
import { holders } from "./schema";
import { resetDatabase } from "./testing";

/**
 * End-to-end money scenarios against a real repository.
 *
 * The pure functions are tested elsewhere; what is checked here is the path a
 * dollar actually takes — buy, top up, redeliver, decay, take down — because
 * every money bug found so far lived in the seams between those, not inside
 * any one of them.
 */

const T0 = 1_700_000_000_000;

async function wall(now = T0) {
  return buildMapState({ ...(await loadMapDataset(db, now)), now });
}
const shareOf = (state: Awaited<ReturnType<typeof wall>>, handle: string) =>
  state.standings.find((s) => s.holder.handle === handle)?.share ?? 0;
const centsOf = (state: Awaited<ReturnType<typeof wall>>, handle: string) =>
  state.standings.find((s) => s.holder.handle === handle)?.liveCents ?? 0;

beforeEach(resetDatabase);

describe("a dollar's journey", () => {
  it("credits the exact amount paid, once", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 1_234 }, T0);
    const state = await wall();
    expect(centsOf(state, "a.com")).toBe(1_234);
    expect(state.counters.liveCents).toBe(1_234);
  });

  it("gives a lone founding square the whole wall", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 5_000 }, T0);
    expect(shareOf(await wall(), "a.com")).toBe(1);
  });

  it("splits exactly in proportion to spend, under the ceiling", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 5_500 }, T0);
    await recordPurchase(db, { handle: "b.com", url: "https://b.com", amountCents: 4_500 }, T0);
    const state = await wall();
    expect(shareOf(state, "a.com")).toBeCloseTo(0.55, 10);
    expect(shareOf(state, "b.com")).toBeCloseTo(0.45, 10);
  });

  it("stops at the ceiling once spend would breach it", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 7_500 }, T0);
    await recordPurchase(db, { handle: "b.com", url: "https://b.com", amountCents: 2_500 }, T0);
    const state = await wall();
    // Two squares: the ceiling is 60%, so 75% of the spend renders as 60%.
    expect(shareOf(state, "a.com")).toBeCloseTo(ceilingFor(2), 10);
    expect(shareOf(state, "a.com") + shareOf(state, "b.com")).toBeCloseTo(1, 10);
  });

  it("never creates or destroys money across many purchases", async () => {
    let expected = 0;
    for (let i = 0; i < 30; i++) {
      const amount = 100 + i * 137;
      expected += amount;
      await recordPurchase(
        db,
        { handle: `h${i % 7}.com`, url: `https://h${i % 7}.com`, amountCents: amount },
        T0,
      );
    }
    const state = await wall();
    expect(state.counters.liveCents).toBeCloseTo(expected, 6);
    const summed = state.standings.reduce((sum, s) => sum + s.liveCents, 0);
    expect(summed).toBeCloseTo(expected, 6);
  });

  it("always divides the whole wall and no more", async () => {
    for (let n = 1; n <= 14; n++) {
      await resetDatabase();
      for (let i = 0; i < n; i++) {
        await recordPurchase(
          db,
          { handle: `s${i}.com`, url: `https://s${i}.com`, amountCents: (i + 1) * 500 },
          T0,
        );
      }
      const total = (await wall()).standings.reduce((sum, s) => sum + s.share, 0);
      expect(total, `${n} squares`).toBeCloseTo(1, 9);
    }
  });
});

describe("topping up", () => {
  it("adds to the same square instead of creating a second one", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 1_000 }, T0);
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 2_000 }, T0);
    const state = await wall();
    expect(state.standings.filter((s) => s.holder.handle === "a.com")).toHaveLength(1);
    expect(centsOf(state, "a.com")).toBe(3_000);
  });

  it("keeps the deep link the buyer paid for", async () => {
    await recordPurchase(
      db,
      { handle: "a.com", url: "https://a.com/launch/pricing", amountCents: 5_000 },
      T0,
    );
    // The form invites "enter the same URL to top up", so people type the bare
    // domain. That must not silently repoint every future click.
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 1_000 }, T0);
    const state = await wall();
    expect(state.standings[0]?.holder.url).toBe("https://a.com/launch/pricing");
  });

  it("reports an honest was → is on the purchase", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 5_000 }, T0);
    await recordPurchase(db, { handle: "b.com", url: "https://b.com", amountCents: 5_000 }, T0);
    const top = await recordPurchase(
      db,
      { handle: "b.com", url: "https://b.com", amountCents: 10_000 },
      T0,
    );
    expect(top.isNew).toBe(false);
    expect(top.shareBefore).toBeCloseTo(0.5, 6);
    // 75% of the spend, rendered at the two-square ceiling.
    expect(top.shareAfter).toBeCloseTo(ceilingFor(2), 6);
    expect(top.shareAfter).toBeGreaterThan(top.shareBefore ?? 0);
  });
});

describe("provider redelivery", () => {
  it("does not double-credit the same order", async () => {
    const order = {
      handle: "a.com",
      url: "https://a.com",
      amountCents: 9_900,
      externalOrderId: "ord_1",
    };
    const first = await recordPurchase(db, order, T0);
    const second = await recordPurchase(db, order, T0 + 5_000);
    expect(second.purchase.id).toBe(first.purchase.id);
    const state = await wall();
    expect(centsOf(state, "a.com")).toBe(9_900);
    expect(state.standings).toHaveLength(1);
  });

  it("survives many redeliveries of the same order", async () => {
    for (let i = 0; i < 6; i++) {
      await recordPurchase(
        db,
        { handle: "a.com", url: "https://a.com", amountCents: 2_500, externalOrderId: "ord_x" },
        T0 + i * 1_000,
      );
    }
    expect(centsOf(await wall(), "a.com")).toBe(2_500);
  });

  it("still treats genuinely different orders as separate purchases", async () => {
    await recordPurchase(
      db,
      { handle: "a.com", url: "https://a.com", amountCents: 1_000, externalOrderId: "ord_1" },
      T0,
    );
    await recordPurchase(
      db,
      { handle: "a.com", url: "https://a.com", amountCents: 1_000, externalOrderId: "ord_2" },
      T0,
    );
    expect(centsOf(await wall(), "a.com")).toBe(2_000);
  });
});

describe("what the buyer is quoted", () => {
  it("is never more than the wall delivers, at any size or amount", async () => {
    for (const squares of [1, 2, 5, 9, 10, 25]) {
      await resetDatabase();
      for (let i = 0; i < squares; i++) {
        await recordPurchase(
          db,
          { handle: `s${i}.com`, url: `https://s${i}.com`, amountCents: 2_000 },
          T0,
        );
      }
      const before = await wall();
      for (const amount of [100, 1_000, 20_000, 500_000, 2_000_000]) {
        const quoted = shareAfterSpend(
          before.standings.map((s) => ({ id: s.holder.id, liveCents: s.liveCents })),
          amount,
        );
        await recordPurchase(
          db,
          { handle: "buyer.com", url: "https://buyer.com", amountCents: amount },
          T0,
        );
        const delivered = shareOf(await wall(), "buyer.com");
        expect(delivered, `${squares} squares, $${amount / 100}`).toBeGreaterThanOrEqual(
          quoted - 1e-9,
        );
        await resetDatabase();
        for (let i = 0; i < squares; i++) {
          await recordPurchase(
            db,
            { handle: `s${i}.com`, url: `https://s${i}.com`, amountCents: 2_000 },
            T0,
          );
        }
      }
    }
  });

  it("holds a ceiling nobody can buy past", async () => {
    for (let i = 0; i < 14; i++) {
      await recordPurchase(
        db,
        { handle: `s${i}.com`, url: `https://s${i}.com`, amountCents: 1_000 },
        T0,
      );
    }
    await recordPurchase(
      db,
      { handle: "whale.com", url: "https://whale.com", amountCents: 2_000_000 },
      T0,
    );
    const state = await wall();
    const ceiling = ceilingFor(state.standings.length);
    for (const s of state.standings) {
      expect(s.share, s.holder.handle).toBeLessThanOrEqual(ceiling + 1e-9);
    }
  });

  it("leaves every other square visible even against the largest possible spend", async () => {
    for (let i = 0; i < 9; i++) {
      await recordPurchase(
        db,
        { handle: `s${i}.com`, url: `https://s${i}.com`, amountCents: MIN_SPEND_CENTS },
        T0,
      );
    }
    await recordPurchase(
      db,
      { handle: "whale.com", url: "https://whale.com", amountCents: 2_000_000 },
      T0,
    );
    for (const s of (await wall()).standings) {
      expect(s.share, s.holder.handle).toBeGreaterThan(0);
    }
  });
});

describe("clamping what can be charged", () => {
  it("refuses to record less than the minimum", () => {
    expect(clampSpend(0)).toBe(MIN_SPEND_CENTS);
    expect(clampSpend(-100_000)).toBe(MIN_SPEND_CENTS);
    expect(clampSpend(2_000_001)).toBe(2_000_001);
    expect(clampSpend(Number.POSITIVE_INFINITY)).toBe(MIN_SPEND_CENTS);
    expect(clampSpend(Number.NEGATIVE_INFINITY)).toBe(MIN_SPEND_CENTS);
    expect(clampSpend(Number.NaN)).toBe(MIN_SPEND_CENTS);
  });

  it("never records a fraction of a cent", () => {
    for (const v of [100.4, 100.5, 999.99, 12_345.678]) {
      expect(Number.isInteger(clampSpend(v))).toBe(true);
    }
  });
});

describe("fading", () => {
  it("halves on schedule and never goes negative", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 10_000 }, T0);
    const at = async (days: number) => centsOf(await wall(T0 + days * MS_PER_DAY), "a.com");
    expect(await at(0)).toBeCloseTo(10_000, 6);
    expect(await at(HALF_LIFE_DAYS)).toBeCloseTo(5_000, 6);
    expect(await at(HALF_LIFE_DAYS * 2)).toBeCloseTo(2_500, 6);
    expect(await at(3_650)).toBeGreaterThanOrEqual(0);
  });

  it("does not move shares while everyone fades together", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 7_000 }, T0);
    await recordPurchase(db, { handle: "b.com", url: "https://b.com", amountCents: 3_000 }, T0);
    const now = await wall();
    const later = await wall(T0 + 60 * MS_PER_DAY);
    expect(shareOf(later, "a.com")).toBeCloseTo(shareOf(now, "a.com"), 9);
    expect(shareOf(later, "b.com")).toBeCloseTo(shareOf(now, "b.com"), 9);
  });

  it("keeps all-time spend intact however far it fades", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 10_000 }, T0);
    const later = await wall(T0 + 90 * MS_PER_DAY);
    expect(later.standings[0]?.allTimeCents).toBe(10_000);
    expect(later.standings[0]?.liveCents).toBeLessThan(10_000);
  });
});

describe("taking a square down", () => {
  it("removes it from the wall without inflating anyone unfairly", async () => {
    await recordPurchase(db, { handle: "a.com", url: "https://a.com", amountCents: 5_000 }, T0);
    await recordPurchase(db, { handle: "b.com", url: "https://b.com", amountCents: 3_000 }, T0);
    await recordPurchase(db, { handle: "bad.com", url: "https://bad.com", amountCents: 2_000 }, T0);

    const before = await wall();
    expect(before.counters.liveCents).toBe(10_000);

    await db.update(holders).set({ status: "rejected" }).where(eq(holders.handle, "bad.com"));

    const after = await wall();
    expect(after.standings.map((s) => s.holder.handle)).not.toContain("bad.com");
    expect(after.counters.liveCents).toBe(8_000);
    // The removed square's spend leaves the wall entirely — the survivors are
    // re-shared from 8,000, not handed the dead square's 2,000.
    expect(centsOf(after, "a.com")).toBe(5_000);
    expect(centsOf(after, "b.com")).toBe(3_000);
  });
});

/**
 * Where a square's line comes from, and — more importantly — when it does not
 * change. Both backends must answer identically; a demo that behaves
 * differently from production is worse than no demo.
 */
describe("the line under the name", () => {
  it("fills an empty square from the site when the buyer writes nothing", async () => {
    const made = await recordPurchase(
      db,
      {
        handle: "a.com",
        url: "https://a.com",
        amountCents: 5_000,
        fallbackTagline: "What their own site says.",
      },
      T0,
    );
    expect(made.holder.tagline).toBe("What their own site says.");
  });

  it("prefers the buyer's own words over the site's", async () => {
    const made = await recordPurchase(
      db,
      {
        handle: "a.com",
        url: "https://a.com",
        amountCents: 5_000,
        tagline: "What I wrote.",
        fallbackTagline: "What their site says.",
      },
      T0,
    );
    expect(made.holder.tagline).toBe("What I wrote.");
  });

  it("never lets a top-up replace a written line with the site's description", async () => {
    await recordPurchase(
      db,
      { handle: "a.com", url: "https://a.com", amountCents: 5_000, tagline: "Carefully chosen." },
      T0,
    );
    // Same square, topped up, buyer left the field blank.
    await recordPurchase(
      db,
      {
        handle: "a.com",
        url: "https://a.com",
        amountCents: 1_000,
        fallbackTagline: "Generic meta description.",
      },
      T0,
    );
    const state = await wall();
    expect(state.standings[0]?.holder.tagline).toBe("Carefully chosen.");
  });

  it("does let a top-up change it when the buyer writes a new one", async () => {
    await recordPurchase(
      db,
      { handle: "a.com", url: "https://a.com", amountCents: 5_000, tagline: "First attempt." },
      T0,
    );
    await recordPurchase(
      db,
      { handle: "a.com", url: "https://a.com", amountCents: 1_000, tagline: "Better line." },
      T0,
    );
    expect((await wall()).standings[0]?.holder.tagline).toBe("Better line.");
  });
});
