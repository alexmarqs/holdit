import type { MapInput } from "./map";
import type { ActivityEvent, Holder, Purchase } from "./types";

/**
 * Builds the rows `buildMapState` reads, without a database.
 *
 * For tests whose subject is the arithmetic rather than the storage. Going
 * through a real backend to reach `buildMapState` only adds a dependency to
 * something that is already a pure function of these rows.
 */

export interface SquareSpec {
  handle: string;
  /** One entry per purchase, so a top-up is two amounts. */
  cents: number | number[];
  /** When the purchase(s) landed. Defaults to `now`. */
  at?: number | number[];
  status?: Holder["status"];
  clicksAllTime?: number;
  clicksLastHour?: number;
}

export interface WallSpec {
  now: number;
  visitorsSinceLaunch?: number;
  onlineNow?: number | null;
  mapArea?: number;
}

export function wallInput(squares: readonly SquareSpec[], spec: WallSpec): MapInput {
  const holders: Holder[] = [];
  const purchasesByHolder = new Map<string, Purchase[]>();
  const clicksAllTimeByHolder = new Map<string, number>();
  const clicksLastHourByHolder = new Map<string, number>();
  const activity: ActivityEvent[] = [];
  let seq = 0;

  squares.forEach((square, index) => {
    const id = `fixture-${index}`;
    holders.push({
      id,
      handle: square.handle,
      url: `https://${square.handle.replace(/^@/, "x.com/")}`,
      tagline: null,
      status: square.status ?? "live",
      createdAt: spec.now,
    });

    const amounts = Array.isArray(square.cents) ? square.cents : [square.cents];
    const times = Array.isArray(square.at) ? square.at : [square.at ?? spec.now];
    const rows = amounts.map((amountCents, i) => ({
      id: `fixture-purchase-${seq++}`,
      holderId: id,
      amountCents,
      createdAt: times[i] ?? times[times.length - 1] ?? spec.now,
      refundedAt: null,
    }));
    purchasesByHolder.set(id, rows);

    if (square.clicksAllTime) clicksAllTimeByHolder.set(id, square.clicksAllTime);
    if (square.clicksLastHour) clicksLastHourByHolder.set(id, square.clicksLastHour);

    for (const [i, row] of rows.entries()) {
      activity.push({
        id: row.id,
        handle: square.handle,
        kind: i === 0 ? "bought_in" : "topped_up",
        amountCents: row.amountCents,
        shareBefore: i === 0 ? null : 0,
        shareAfter: 0,
        at: row.createdAt,
      });
    }
  });

  activity.sort((a, b) => b.at - a.at);

  return {
    holders,
    purchasesByHolder,
    clicksAllTimeByHolder,
    clicksLastHourByHolder,
    activity,
    visitorsSinceLaunch: spec.visitorsSinceLaunch ?? 0,
    onlineNow: spec.onlineNow ?? null,
    mapArea: spec.mapArea,
    now: spec.now,
  };
}
