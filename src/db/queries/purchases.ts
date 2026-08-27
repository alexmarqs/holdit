import type { Holder, Purchase } from "@holdit/core";
import { buildMapState, clampSpend } from "@holdit/core";
import { eq, sql } from "drizzle-orm";
import { normalizeTarget } from "@/lib/utils/domain";
import type { Database, Queryable } from "../client";
import { num, toHolder, toPurchase } from "../rows";
import { holders, purchases } from "../schema";
import { loadWallRows } from "./dataset";

export interface RecordPurchaseInput {
  handle: string;
  url: string;
  /** Written by the buyer. Overwrites whatever the square had. */
  tagline?: string | null;
  /**
   * Read off the destination when the buyer left the field blank. Applied only
   * when the square is created — a top-up must never replace a line somebody
   * wrote with the site's generic meta description, which is the same mistake
   * as letting a bare-domain top-up erase a paid-for deep link.
   */
  fallbackTagline?: string | null;
  amountCents: number;
  /** Stripe checkout session id, or null for a local development purchase. */
  externalOrderId?: string | null;
  email?: string | null;
}

export interface RecordPurchaseResult {
  holder: Holder;
  purchase: Purchase;
  /** Null when the square is new — there was no share to dilute. */
  shareBefore: number | null;
  shareAfter: number;
  isNew: boolean;
}

export interface BuyInput {
  /** Whatever the buyer typed. Normalised here, once. */
  target: string;
  amountCents: number;
  tagline?: string | null;
  /** Site meta, already fetched. Queries do not go to the network. */
  fallbackTagline?: string | null;
  externalOrderId?: string | null;
  email?: string | null;
}

export class InvalidTargetError extends Error {
  constructor(target: string) {
    super(`"${target}" is not a domain or @handle.`);
    this.name = "InvalidTargetError";
  }
}

async function checkIdempotency(
  db: Queryable,
  externalOrderId: string,
): Promise<RecordPurchaseResult | null> {
  const [prior] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.externalOrderId, externalOrderId))
    .limit(1);
  if (!prior) return null;

  const [owner] = await db.select().from(holders).where(eq(holders.id, prior.holderId)).limit(1);
  if (!owner) throw new Error(`Purchase ${prior.id} has no holder`);

  return {
    holder: toHolder(owner),
    purchase: toPurchase(prior),
    shareBefore: prior.shareBefore === null ? null : num(prior.shareBefore),
    shareAfter: num(prior.shareAfter),
    isNew: prior.shareBefore === null,
  };
}

/**
 * Append a purchase and let the map resize.
 *
 * Position is a share of a sum rather than a slot somebody occupies, so both
 * simultaneous payments can land. Their short write transactions are ordered
 * below because the activity feed's frozen before/after shares do have an
 * order. Returns those shares without recomputing history.
 */
export async function recordPurchase(
  db: Database,
  input: RecordPurchaseInput,
  now: number,
): Promise<RecordPurchaseResult> {
  return db.transaction(async (tx) => {
    // Only writes for the same square wait. Different handles remain fully
    // concurrent because wall position is a share of a sum, not a claimed slot.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`holdit:purchase:${input.handle}`}, 0))`,
    );

    // Duplicate Stripe deliveries can overlap. Recheck after the holder lock
    // so the waiter returns the purchase the first delivery wrote.
    if (input.externalOrderId) {
      const recorded = await checkIdempotency(tx, input.externalOrderId);
      if (recorded) return recorded;
    }

    // Read the map as it stands, so the feed can quote an honest "was → is".
    const beforeRows = await loadWallRows(tx, now);
    const before = buildMapState({ ...beforeRows, now });
    const [existing] = await tx
      .select()
      .from(holders)
      .where(eq(holders.handle, input.handle))
      .limit(1);

    const [inserted] = existing
      ? []
      : await tx
          .insert(holders)
          .values({
            handle: input.handle,
            url: input.url,
            tagline: input.tagline ?? input.fallbackTagline ?? null,
            email: input.email ?? null,
            status: "live",
            createdAt: new Date(now),
          })
          .onConflictDoNothing({ target: holders.handle })
          .returning();
    const holderRow =
      existing ??
      inserted ??
      (await tx.select().from(holders).where(eq(holders.handle, input.handle)).limit(1))[0];
    if (!holderRow) throw new Error(`Could not create or find holder ${input.handle}`);

    let holder = toHolder(holderRow);
    const isNew = inserted !== undefined;
    const shareBefore = isNew
      ? null
      : (before.standings.find((standing) => standing.holder.id === holder.id)?.share ?? 0);

    /*
     * A line the buyer wrote on a top-up is an edit they asked for, so it lands.
     * A line we read off their site is not: it only ever fills an empty square at
     * creation, never replaces one somebody chose.
     */
    if (!isNew && input.tagline) {
      const [updated] = await tx
        .update(holders)
        .set({ tagline: input.tagline })
        .where(eq(holders.id, holder.id))
        .returning();
      if (updated) holder = toHolder(updated);
    }

    const [row] = await tx
      .insert(purchases)
      .values({
        holderId: holder.id,
        amountCents: input.amountCents,
        shareBefore: shareBefore === null ? null : String(shareBefore),
        shareAfter: "0",
        provider: input.externalOrderId ? "stripe" : "local",
        externalOrderId: input.externalOrderId ?? null,
        createdAt: new Date(now),
      })
      .returning();
    if (!row) throw new Error("Purchase insert returned no row");

    const purchasesAfter = new Map(beforeRows.purchasesByHolder);
    purchasesAfter.set(holder.id, [...(purchasesAfter.get(holder.id) ?? []), toPurchase(row)]);
    const holdersAfter = isNew
      ? [...beforeRows.holders, holder]
      : beforeRows.holders.map((prior) => (prior.id === holder.id ? holder : prior));
    const after = buildMapState({
      holders: holdersAfter,
      purchasesByHolder: purchasesAfter,
      now,
    });
    const shareAfter = after.standings.find((s) => s.holder.id === holder.id)?.share ?? 0;
    const [finalized] = await tx
      .update(purchases)
      .set({ shareAfter: String(shareAfter) })
      .where(eq(purchases.id, row.id))
      .returning();
    if (!finalized) throw new Error(`Purchase ${row.id} could not be finalized`);

    return {
      holder,
      purchase: toPurchase(finalized),
      shareBefore,
      shareAfter,
      isNew,
    };
  });
}

/**
 * The public entry point: normalise what the buyer typed, then append.
 *
 * A line for the square is whoever called: the one the buyer wrote, or the
 * site's own meta passed as `fallbackTagline`. This function does not fetch.
 */
export async function buy(db: Database, input: BuyInput): Promise<RecordPurchaseResult> {
  const normalized = normalizeTarget(input.target);
  if (!normalized) throw new InvalidTargetError(input.target);

  const written = input.tagline?.trim() || null;

  return recordPurchase(
    db,
    {
      handle: normalized.handle,
      url: normalized.url,
      tagline: written,
      fallbackTagline: written ? null : (input.fallbackTagline ?? null),
      amountCents: clampSpend(input.amountCents),
      externalOrderId: input.externalOrderId ?? null,
      email: input.email ?? null,
    },
    Date.now(),
  );
}
