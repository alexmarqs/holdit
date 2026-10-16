import { describe, expect, it } from "vitest";
import { HALF_LIFE_DAYS, MS_PER_DAY } from "../config";
import { allTimeCents, decayFactor, halvesAt, liveCentsForHolder, purchasesAsOf } from "./decay";

const NOW = Date.UTC(2026, 7, 21);
const daysAgo = (d: number) => NOW - d * MS_PER_DAY;
const buy = (amountCents: number, ageDays = 0, refunded = false) => ({
  amountCents,
  createdAt: daysAgo(ageDays),
  refundedAt: refunded ? NOW : null,
});

describe("decayFactor", () => {
  it("is 1 at purchase time and halves each half-life", () => {
    expect(decayFactor(0)).toBe(1);
    expect(decayFactor(HALF_LIFE_DAYS * MS_PER_DAY)).toBeCloseTo(0.5, 10);
    expect(decayFactor(2 * HALF_LIFE_DAYS * MS_PER_DAY)).toBeCloseTo(0.25, 10);
  });

  it("treats a future timestamp as unfaded rather than amplified", () => {
    expect(decayFactor(-MS_PER_DAY)).toBe(1);
  });
});

describe("liveCentsForHolder", () => {
  it("sums faded purchases", () => {
    expect(liveCentsForHolder([buy(10_000), buy(10_000, 14)], NOW)).toBeCloseTo(15_000, 6);
  });

  it("ignores refunded purchases entirely", () => {
    expect(liveCentsForHolder([buy(50_000, 0, true)], NOW)).toBe(0);
  });

  it("halves a whale on the same clock as a dollar", () => {
    expect(liveCentsForHolder([buy(100_000, 14)], NOW)).toBeCloseTo(50_000, 6);
  });
});

describe("purchasesAsOf", () => {
  it("drops a purchase that had not happened yet", () => {
    const kept = { amountCents: 10_000, createdAt: NOW - 1_000, refundedAt: null };
    const later = { amountCents: 50_000, createdAt: NOW + 1_000, refundedAt: null };
    expect(purchasesAsOf([kept, later], NOW)).toEqual([kept]);
  });

  it("treats a refund after the print as still live", () => {
    const purchase = { amountCents: 10_000, createdAt: NOW - 1_000, refundedAt: NOW + 1_000 };
    expect(purchasesAsOf([purchase], NOW)).toEqual([{ ...purchase, refundedAt: null }]);
  });

  it("keeps a refund that had already landed", () => {
    const purchase = { amountCents: 10_000, createdAt: NOW - 2_000, refundedAt: NOW - 500 };
    expect(purchasesAsOf([purchase], NOW)).toEqual([purchase]);
  });
});

describe("allTimeCents", () => {
  it("never fades — you lose prominence, not history", () => {
    expect(allTimeCents([buy(1_000), buy(15_000), buy(900, 0, true)])).toBe(16_000);
  });
});

describe("halvesAt", () => {
  it("is one half-life from now — the instant live spend is half if nobody buys", () => {
    expect(halvesAt(NOW)).toBe(NOW + HALF_LIFE_DAYS * MS_PER_DAY);
    expect(liveCentsForHolder([buy(10_000)], halvesAt(NOW))).toBeCloseTo(5_000, 6);
  });
});
