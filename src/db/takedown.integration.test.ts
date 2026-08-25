import type { Holder } from "@holdit/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./client";
import { loadMapDataset } from "./queries/dataset";
import { recordPurchase } from "./queries/purchases";
import { holders, purchases } from "./schema";
import { resetDatabase } from "./testing";

const NOW = Date.UTC(2026, 7, 22);

const buy = (handle: string, amountCents = 5_000) =>
  recordPurchase(db, { handle, url: `https://${handle}`, amountCents }, NOW);

/**
 * There is no moderation UI: a square comes down by flipping `status` in the
 * database. These tests cover the half that has to be right for that to work —
 * that the wall reads only live squares, and that a dead one stops counting.
 */
const setStatus = async (handle: string, status: Holder["status"]) => {
  const changed = await db
    .update(holders)
    .set({ status })
    .where(eq(holders.handle, handle))
    .returning({ id: holders.id });
  if (changed.length === 0) throw new Error(`no square for ${handle}`);
};

describe("taking a square down", () => {
  beforeEach(resetDatabase);

  it("puts a square up the moment it is paid for", async () => {
    const result = await buy("instant.dev");
    expect(result.holder.status).toBe("live");

    const dataset = await loadMapDataset(db, NOW);
    expect(dataset.holders.some((h) => h.handle === "instant.dev")).toBe(true);
  });

  it("removes it from the wall when the status changes", async () => {
    await buy("breaks-the-rules.dev");
    await setStatus("breaks-the-rules.dev", "rejected");

    const dataset = await loadMapDataset(db, NOW);
    expect(dataset.holders.some((h) => h.handle === "breaks-the-rules.dev")).toBe(false);
  });

  it("stops a dead square diluting everyone else", async () => {
    await buy("good.dev", 10_000);
    const withBoth = await buy("bad.dev", 90_000);
    expect(withBoth.holder.status).toBe("live");

    const before = await loadMapDataset(db, NOW);
    expect(before.purchasesByHolder.has(withBoth.holder.id)).toBe(true);

    await setStatus("bad.dev", "rejected");
    const after = await loadMapDataset(db, NOW);

    // Its spend must leave the total too, or the survivors keep being diluted
    // by a square nobody can see.
    expect(after.purchasesByHolder.has(withBoth.holder.id)).toBe(false);
    expect(after.purchasesByHolder.size).toBe(before.purchasesByHolder.size - 1);
    expect(after.holders.some((h) => h.handle === "bad.dev")).toBe(false);
    expect(after.holders.some((h) => h.handle === "good.dev")).toBe(true);
  });

  it("keeps the purchase record, so the money is still accounted for", async () => {
    const { holder } = await buy("bad.dev");
    await setStatus("bad.dev", "rejected");

    // Off the wall, but not erased — a refund needs something to refund against.
    const rows = await db.select().from(purchases).where(eq(purchases.holderId, holder.id));
    expect(rows).toHaveLength(1);
  });
});

describe("topping up an existing square", () => {
  beforeEach(resetDatabase);

  const urlOf = async (handle: string) =>
    (await loadMapDataset(db, NOW)).holders.find((h) => h.handle === handle)?.url;

  it("keeps the destination when someone tops up with the bare domain", async () => {
    await recordPurchase(
      db,
      { handle: "deep.dev", url: "https://deep.dev/features/thing", amountCents: 10_000 },
      NOW,
    );
    expect(await urlOf("deep.dev")).toBe("https://deep.dev/features/thing");

    // The form invites "enter the same URL to top up", so people type the bare
    // domain. That must not erase the path they paid for.
    await recordPurchase(
      db,
      { handle: "deep.dev", url: "https://deep.dev", amountCents: 5_000 },
      NOW,
    );
    expect(await urlOf("deep.dev")).toBe("https://deep.dev/features/thing");
  });

  it("adds to the spend rather than replacing it", async () => {
    await recordPurchase(
      db,
      { handle: "sum.dev", url: "https://sum.dev", amountCents: 12_000 },
      NOW,
    );
    const second = await recordPurchase(
      db,
      { handle: "sum.dev", url: "https://sum.dev", amountCents: 8_000 },
      NOW,
    );
    expect(second.isNew).toBe(false);

    const dataset = await loadMapDataset(db, NOW);
    const rows = dataset.purchasesByHolder.get(second.holder.id) ?? [];
    expect(rows).toHaveLength(2);
    expect(rows.reduce((t, r) => t + r.amountCents, 0)).toBe(20_000);
  });
});
