import { type ActivityEvent, type Holder, ONLINE_WINDOW_MS, type Purchase } from "@holdit/core";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Queryable } from "../client";
import { num, toHolder, toPurchase } from "../rows";
import { clicks, holders, purchases, visits } from "../schema";

/**
 * Everything one render of the map needs, in a single round trip.
 *
 * Deliberately raw: the derived numbers — fading, share, cap, floor, trending —
 * are computed by `buildMapState` in `@holdit/core`, so this layer only has to
 * return rows, never behaviour.
 */
export interface MapRows {
  holders: Holder[];
  purchasesByHolder: Map<string, Purchase[]>;
  clicksAllTimeByHolder: Map<string, number>;
  activity: ActivityEvent[];
  visitorsSinceLaunch: number;
  /** Distinct visitors seen inside `ONLINE_WINDOW_MS`. */
  onlineNow: number;
}

/** Live activity feed length. Long enough to look alive, short enough to be cheap. */
const ACTIVITY_LIMIT = 12;

export async function loadWallRows(
  db: Queryable,
  now: number,
): Promise<Pick<MapRows, "holders" | "purchasesByHolder">> {
  const at = new Date(now);
  const [holderRows, purchaseRows] = await Promise.all([
    db
      .select()
      .from(holders)
      .where(and(eq(holders.status, "live"), lte(holders.createdAt, at))),
    db.select().from(purchases).where(lte(purchases.createdAt, at)).orderBy(purchases.createdAt),
  ]);

  const liveIds = new Set(holderRows.map((holder) => holder.id));
  const purchasesByHolder = new Map<string, Purchase[]>();
  for (const row of purchaseRows) {
    if (!liveIds.has(row.holderId)) continue;
    const bucket = purchasesByHolder.get(row.holderId);
    if (bucket) bucket.push(toPurchase(row));
    else purchasesByHolder.set(row.holderId, [toPurchase(row)]);
  }

  return { holders: holderRows.map(toHolder), purchasesByHolder };
}

export async function loadMapRows(
  db: Queryable,
  now: number,
  options: { includeOnline?: boolean } = {},
): Promise<MapRows> {
  const at = new Date(now);

  const clickTotalsQuery = db
    .select({ holderId: clicks.holderId, n: sql<number>`count(*)::int` })
    .from(clicks)
    .where(and(eq(clicks.uaClass, "browser"), lte(clicks.ts, at)))
    .groupBy(clicks.holderId);

  const onlineQuery =
    options.includeOnline === false
      ? Promise.resolve([{ n: 0 }])
      : db
          .select({ n: sql<number>`count(*)::int` })
          .from(visits)
          .where(
            and(
              gte(visits.lastSeenAt, new Date(now - ONLINE_WINDOW_MS)),
              lte(visits.lastSeenAt, at),
            ),
          );

  const [wallRows, clickTotals, visitCount, onlineCount, feed] = await Promise.all([
    loadWallRows(db, now),
    clickTotalsQuery,
    db.select({ n: sql<number>`count(*)::int` }).from(visits).where(lte(visits.firstSeenAt, at)),
    onlineQuery,
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
      .where(and(eq(holders.status, "live"), lte(purchases.createdAt, at)))
      .orderBy(desc(purchases.createdAt))
      .limit(ACTIVITY_LIMIT),
  ]);

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
    ...wallRows,
    clicksAllTimeByHolder: counts(clickTotals),
    activity,
    visitorsSinceLaunch: visitCount[0]?.n ?? 0,
    onlineNow: onlineCount[0]?.n ?? 0,
  };
}
