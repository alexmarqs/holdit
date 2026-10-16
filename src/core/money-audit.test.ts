import { describe, expect, it } from "vitest";
import {
  buildMapState,
  ceilingFor,
  centsForShareOf,
  computeShares,
  HALF_LIFE_DAYS,
  MS_PER_DAY,
  shareAfterSpend,
  wallSizeHeldTo,
} from "./index";
import { wallInput } from "./wall-input";

const T0 = 1_700_000_000_000;
const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

describe("money audit", () => {
  it("checks every invariant with real numbers", async () => {
    const spends = [50_000, 30_000, 12_000, 8_000, 5_000, 2_500, 1_000, 500, 200, 100, 100, 100];
    const state = buildMapState(
      wallInput(
        spends.map((cents, i) => ({ handle: `s${i}.com`, cents })),
        { now: T0 },
      ),
    );
    const paid = spends.reduce((a, b) => a + b, 0);
    const cap = ceilingFor(state.standings.length);
    const out: string[] = [];

    const shareSum = state.standings.reduce((n, s) => n + s.share, 0);
    const centsSum = state.standings.reduce((n, s) => n + s.liveCents, 0);
    out.push(`  paid in            ${$(paid)}`);
    out.push(
      `  counters.liveCents ${$(state.counters.liveCents)}   ${state.counters.liveCents === paid ? "exact" : "MISMATCH"}`,
    );
    out.push(
      `  sum of squares     ${$(centsSum)}   ${Math.abs(centsSum - paid) < 1e-6 ? "exact" : "MISMATCH"}`,
    );
    out.push(`  shares total       ${(shareSum * 100).toFixed(9)}%`);
    out.push(
      `  ceiling at n=${state.standings.length}      ${(cap * 100).toFixed(1)}%   biggest ${(Math.max(...state.standings.map((s) => s.share)) * 100).toFixed(2)}%`,
    );

    // Decay: does $100 become $50 at one half-life, on the nose?
    const laterAt = T0 + HALF_LIFE_DAYS * MS_PER_DAY;
    const later = buildMapState(
      wallInput(
        spends.map((cents, i) => ({ handle: `s${i}.com`, cents, at: T0 })),
        { now: laterAt },
      ),
    );
    out.push(`  after ${HALF_LIFE_DAYS} days      ${$(later.counters.liveCents)}`);

    // A lone square with nothing over the cap must halve exactly.
    const soloAt = T0 + HALF_LIFE_DAYS * MS_PER_DAY;
    const soloLater = buildMapState(
      wallInput([{ handle: "one.com", cents: 10_000, at: T0 }], { now: soloAt }),
    );
    out.push(
      `  one square alone   ${$(10_000)} → ${$(soloLater.counters.liveCents)} after ${HALF_LIFE_DAYS} days`,
    );
    expect(soloLater.counters.liveCents).toBeCloseTo(5_000, 6);

    // Quote equals delivery, and a chip delivers the share it names.
    const rows = state.standings.map((s) => ({ id: s.holder.id, liveCents: s.liveCents }));
    out.push("\n     target    quoted price   share delivered   headroom (wall can reach)");
    for (const target of [0.01, 0.025, 0.05, 0.1]) {
      const cost = centsForShareOf(rows, target);
      if (cost === null) {
        // Correctly withheld: the $1 floor already buys more than this.
        out.push(
          `     ${(target * 100).toFixed(1).padStart(5)}%   not offered — the minimum already exceeds it`,
        );
        continue;
      }
      const got = shareAfterSpend(rows, cost);
      out.push(
        `     ${(target * 100).toFixed(1).padStart(5)}%   ${$(cost).padStart(11)}   ` +
          `${(got * 100).toFixed(4).padStart(13)}%   ${$(wallSizeHeldTo(cost, cap))}`,
      );
      expect(got).toBeGreaterThanOrEqual(target - 1e-9);
      // And never wildly over: a chip must land on the share it names.
      expect(got).toBeLessThan(target * 1.05);
    }

    // Cap redistribution must not invent money.
    const capped = computeShares(rows);
    expect(capped.reduce((n, r) => n + r.share, 0)).toBeCloseTo(1, 12);
    expect(state.counters.liveCents).toBe(paid);
    expect(later.counters.liveCents).toBeCloseTo(paid / 2, 6);

    process.stderr.write(`\n${out.join("\n")}\n\n`);
  });
});
