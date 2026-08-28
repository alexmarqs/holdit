import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./client";
import { loadMapRows } from "./queries/dataset";
import { getMapState } from "./queries/map";
import { recordPurchase } from "./queries/purchases";
import { clicks, holders, visits } from "./schema";
import { resetDatabase } from "./testing";

const T0 = 1_700_000_000_000;

describe("timestamped map datasets", () => {
  beforeEach(resetDatabase);

  it("does not include records created after the requested timestamp", async () => {
    const early = await recordPurchase(
      db,
      { handle: "early.com", url: "https://early.com", amountCents: 1_000 },
      T0 - 1_000,
    );
    const late = await recordPurchase(
      db,
      { handle: "late.com", url: "https://late.com", amountCents: 2_000 },
      T0 + 1_000,
    );

    await db.insert(clicks).values([
      {
        holderId: early.holder.id,
        ipHash: "early-click",
        uaClass: "browser",
        ts: new Date(T0 - 500),
      },
      {
        holderId: early.holder.id,
        ipHash: "late-click",
        uaClass: "browser",
        ts: new Date(T0 + 500),
      },
    ]);
    await db.insert(visits).values([
      {
        visitorHash: "early-visitor",
        firstSeenAt: new Date(T0 - 500),
        lastSeenAt: new Date(T0 - 500),
      },
      {
        visitorHash: "late-visitor",
        firstSeenAt: new Date(T0 + 500),
        lastSeenAt: new Date(T0 + 500),
      },
    ]);

    const rows = await loadMapRows(db, T0);

    expect(rows.holders.map((holder) => holder.handle)).toEqual(["early.com"]);
    expect(rows.purchasesByHolder.has(late.holder.id)).toBe(false);
    expect(rows.clicksAllTimeByHolder.get(early.holder.id)).toBe(1);
    expect(rows.clicksLastHourByHolder.get(early.holder.id)).toBe(1);
    expect(rows.visitorsSinceLaunch).toBe(1);
    expect(rows.activity.map((event) => event.handle)).toEqual(["early.com"]);
  });

  it("excludes rejected holders from activity", async () => {
    await recordPurchase(
      db,
      { handle: "kept.com", url: "https://kept.com", amountCents: 1_000 },
      T0 - 2_000,
    );
    await recordPurchase(
      db,
      { handle: "removed.com", url: "https://removed.com", amountCents: 2_000 },
      T0 - 1_000,
    );
    await db.update(holders).set({ status: "rejected" }).where(eq(holders.handle, "removed.com"));

    const rows = await loadMapRows(db, T0);

    expect(rows.activity.map((event) => event.handle)).toEqual(["kept.com"]);
  });

  it("does not pretend mutable presence is historically reconstructible", async () => {
    await db.insert(visits).values({
      visitorHash: "present",
      firstSeenAt: new Date(T0 - 1_000),
      lastSeenAt: new Date(T0),
    });

    expect((await getMapState(db, { now: T0 })).counters.onlineNow).toBe(0);
  });
});
