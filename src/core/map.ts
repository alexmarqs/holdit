import { allTimeCents, liveCentsForHolder, purchasesAsOf } from "./spend/decay";
import { computeShares } from "./spend/share";
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
  activity?: readonly ActivityEvent[];
  visitorsSinceLaunch?: number;
  /**
   * Distinct visitors seen recently, counted from the `visits` table — requests,
   * not held connections. Null when unknown, which the panels render as absent
   * rather than as zero.
   */
  onlineNow?: number | null;
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
  const purchasesByHolder = new Map(
    [...input.purchasesByHolder].map(([id, list]) => [id, purchasesAsOf(list, now)]),
  );
  const holders = input.holders;
  const live = holders.map((holder) => {
    const purchases = purchasesByHolder.get(holder.id) ?? [];
    return { holder, purchases, liveCents: liveCentsForHolder(purchases, now) };
  });

  const shares = computeShares(
    live.map((row) => ({ id: row.holder.id, liveCents: row.liveCents })),
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

  // Trending is all-time clicks, not a sliding window. A day with no new
  // clicks used to empty the card even when the wall had a real history —
  // the section vanished for a quiet night. All-time still ranks a small
  // square with good copy above a big quiet one.
  const trending: TrendingRow[] = standings
    .map((s) => ({
      handle: s.holder.handle,
      clicks: s.clicksAllTime,
      share: s.share,
    }))
    .filter((row) => row.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
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
