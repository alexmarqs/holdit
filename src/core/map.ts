import { ceilingFor, MIN_TILE_AREA } from "./config";
import { allTimeCents, liveCentsForHolder, purchasesAsOf } from "./spend/decay";
import { computeShares, minShareFor } from "./spend/share";
import type {
  ActivityEvent,
  Holder,
  HolderStanding,
  MapState,
  Purchase,
  TrendingRow,
} from "./types";

export interface MapInput {
  holders: readonly Holder[];
  purchasesByHolder: ReadonlyMap<string, readonly Purchase[]>;
  clicksAllTimeByHolder?: ReadonlyMap<string, number>;
  clicksLastHourByHolder?: ReadonlyMap<string, number>;
  activity?: readonly ActivityEvent[];
  visitorsSinceLaunch?: number;
  /**
   * Distinct visitors seen recently, counted from the `visits` table — requests,
   * not held connections. Null when unknown, which the panels render as absent
   * rather than as zero.
   */
  onlineNow?: number | null;
  /** Canvas area in px², so the minimum tile size becomes a share floor. */
  mapArea?: number;
  now: number;
}

/**
 * Everything the map renders, derived in one pass from raw rows.
 *
 * Kept pure and outside the data layer so the behaviour that matters — who
 * shrinks when somebody buys — is testable without a database.
 */
export function buildMapState(input: MapInput): MapState {
  const now = input.now;
  const clicksAll = input.clicksAllTimeByHolder ?? new Map();
  const clicksHour = input.clicksLastHourByHolder ?? new Map();
  const purchasesByHolder = new Map(
    [...input.purchasesByHolder].map(([id, list]) => [id, purchasesAsOf(list, now)]),
  );
  const holders = input.holders;
  /*
   * Where overflow begins. Two things were wrong here, and both made money
   * persist longer than the rules promise.
   *
   * It must be the ceiling actually applied, not a hardcoded ten percent — on a
   * young wall the ceiling is looser, so 10% classified fully-displayed money
   * as overflow.
   *
   * And it must be drawn in the same units as the purchases it splits. It came
   * from a *decayed* total and was compared against each purchase's *nominal*
   * amount, so a purchase drifted into "overflow" simply by ageing: a lone
   * square's $100 was still worth $60.36 after a fortnight, not the $50 the
   * rules promise.
   */
  let nominal = 0;
  for (const holder of holders) {
    for (const p of purchasesByHolder.get(holder.id) ?? []) {
      if (p.refundedAt === null) nominal += p.amountCents;
    }
  }
  const capCents = nominal > 0 ? ceilingFor(holders.length) * nominal : Number.POSITIVE_INFINITY;

  // Re-price with the overflow rule, so spend that could never have
  // been displayed persists instead of being wasted.
  const live = holders.map((holder) => {
    const purchases = purchasesByHolder.get(holder.id) ?? [];
    return { holder, purchases, liveCents: liveCentsForHolder(purchases, now, capCents) };
  });

  const minShare = input.mapArea ? minShareFor(MIN_TILE_AREA, input.mapArea) : 0;
  const shares = computeShares(
    live.map((row) => ({ id: row.holder.id, liveCents: row.liveCents })),
    { minShare },
  );
  const shareById = new Map(shares.map((s) => [s.id, s]));

  const standings: HolderStanding[] = live
    .map((row) => {
      const share = shareById.get(row.holder.id);
      const last = row.purchases.reduce<{ at: number; id: string } | null>((latest, p) => {
        if (p.refundedAt !== null) return latest;
        if (latest === null || p.createdAt > latest.at) return { at: p.createdAt, id: p.id };
        return latest;
      }, null);
      return {
        holder: row.holder,
        liveCents: row.liveCents,
        allTimeCents: allTimeCents(row.purchases),
        clicksAllTime: clicksAll.get(row.holder.id) ?? 0,
        lastPurchaseAt: last?.at ?? null,
        lastPurchaseId: last?.id ?? null,
        share: share?.share ?? 0,
        rawShare: share?.rawShare ?? 0,
        capped: share?.capped ?? false,
        floored: share?.floored ?? false,
      };
    })
    .sort((a, b) => b.share - a.share || a.holder.handle.localeCompare(b.holder.handle));

  // Trending is deliberately not size order — a small square with good copy can
  // top it, which is the argument that copy beats budget.
  const trending: TrendingRow[] = standings
    .map((s) => ({
      handle: s.holder.handle,
      clicksInWindow: clicksHour.get(s.holder.id) ?? 0,
      share: s.share,
    }))
    .filter((row) => row.clicksInWindow > 0)
    .sort((a, b) => b.clicksInWindow - a.clicksInWindow)
    .slice(0, 5);

  return {
    standings,
    counters: {
      onlineNow: input.onlineNow ?? null,
      clicksAllTime: [...clicksAll.values()].reduce((sum, n) => sum + n, 0),
      visitorsSinceLaunch: input.visitorsSinceLaunch ?? 0,
      liveCents: live.reduce((sum, row) => sum + row.liveCents, 0),
      squaresLive: standings.filter((s) => s.liveCents > 0).length,
    },
    activity: [...(input.activity ?? [])]
      .filter((event) => event.at <= now)
      .sort((a, b) => b.at - a.at)
      .slice(0, 12),
    trending,
    generatedAt: now,
  };
}
