import {
  type ActivityEvent,
  type Holder,
  ONLINE_WINDOW_MS,
  type Purchase,
  TRENDING_WINDOW_MS,
} from "@holdit/core";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../client";
import { num, toHolder, toPurchase } from "../rows";
import { clicks, holders, purchases, visits } from "../schema";

/**
 * Everything one render of the map needs, in a single round trip.
 *
 * Deliberately raw: the derived numbers — fading, share, cap, floor, trending —
 * are computed by `buildMapState` in `@holdit/core`, so this layer only has to
 * return rows, never behaviour.
 */
export interface MapDataset {
  holders: Holder[];
  purchasesByHolder: Map<string, Purchase[]>;
  clicksAllTimeByHolder: Map<string, number>;
  clicksLastHourByHolder: Map<string, number>;
  activity: ActivityEvent[];
  visitorsSinceLaunch: number;
  /** Distinct visitors seen inside `ONLINE_WINDOW_MS`. */
  onlineNow: number;
}

/** Live activity feed length. Long enough to look alive, short enough to be cheap. */
const ACTIVITY_LIMIT = 12;

export async function loadMapDataset(db: Database, now: number): Promise<MapDataset> {
  const trendingSince = new Date(now - TRENDING_WINDOW_MS);

  const countsQuery = (since?: Date) => {
    const where = since
      ? and(eq(clicks.uaClass, "browser"), gte(clicks.ts, since))
      : eq(clicks.uaClass, "browser");
    return db
      .select({ holderId: clicks.holderId, n: sql<number>`count(*)::int` })
      .from(clicks)
      .where(where)
      .groupBy(clicks.holderId);
  };

  const [holderRows, purchaseRows, clickTotals, clickHour, visitCount, onlineCount, feed] =
    await Promise.all([
      db.select().from(holders).where(eq(holders.status, "live")),
      db.select().from(purchases).orderBy(purchases.createdAt),
      countsQuery(),
      countsQuery(trendingSince),
      db.select({ n: sql<number>`count(*)::int` }).from(visits),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(visits)
        .where(gte(visits.lastSeenAt, new Date(now - ONLINE_WINDOW_MS))),
      db
        .select({
          id: purchases.id,
          handle: holders.handle,
          amountCents: purchases.amountCents,
          shareBefore: purchases.shareBefore,
          shareAfter: purchases.shareAfter,
          createdAt: purchases.createdAt,
        })
        .from(purchases)
        .innerJoin(holders, eq(holders.id, purchases.holderId))
        .orderBy(desc(purchases.createdAt))
        .limit(ACTIVITY_LIMIT),
    ]);

  const liveIds = new Set(holderRows.map((h) => h.id));
  const purchasesByHolder = new Map<string, Purchase[]>();
  for (const row of purchaseRows) {
    if (!liveIds.has(row.holderId)) continue;
    const bucket = purchasesByHolder.get(row.holderId);
    if (bucket) bucket.push(toPurchase(row));
    else purchasesByHolder.set(row.holderId, [toPurchase(row)]);
  }

  const counts = (rows: { holderId: string; n: number }[]) =>
    new Map(rows.map((r) => [r.holderId, r.n]));

  const activity: ActivityEvent[] = feed.map((row) => ({
    id: row.id,
    handle: row.handle,
    kind: row.shareBefore === null ? "bought_in" : "topped_up",
    amountCents: row.amountCents,
    shareBefore: row.shareBefore === null ? null : num(row.shareBefore),
    shareAfter: num(row.shareAfter),
    at: row.createdAt.getTime(),
  }));

  return {
    holders: holderRows.map(toHolder),
    purchasesByHolder,
    clicksAllTimeByHolder: counts(clickTotals),
    clicksLastHourByHolder: counts(clickHour),
    activity,
    visitorsSinceLaunch: visitCount[0]?.n ?? 0,
    onlineNow: onlineCount[0]?.n ?? 0,
  };
}
