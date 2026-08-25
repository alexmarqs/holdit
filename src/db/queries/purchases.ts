import type { Holder, Purchase } from "@holdit/core";
import { buildMapState, clampSpend } from "@holdit/core";
import { eq } from "drizzle-orm";
import { normalizeTarget } from "@/lib/utils/domain";
import type { Database } from "../client";
import { num, toHolder, toPurchase } from "../rows";
import { holders, purchases } from "../schema";
import { loadMapRows } from "./dataset";
import { getHolderByHandle, getHolderById } from "./holders";

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

/**
 * Append a purchase and let the map resize.
 *
 * Append-only, and not a race: position is a share of a sum rather than a slot
 * somebody occupies, so two simultaneous buyers cannot conflict. No lock, no
 * queue, no version counter. Both rows land; both squares grow; everyone else
 * shrinks. Returns the share on either side of the write so the activity feed
 * can quote it without recomputing history.
 */
export async function recordPurchase(
  db: Database,
  input: RecordPurchaseInput,
  now: number,
): Promise<RecordPurchaseResult> {
  /*
   * A payment provider redelivers. Without this, the second delivery hit the
   * unique index on `external_order_id`, threw, and the route turned that into
   * a 403 "Invalid signature" — so a routine retry looked like an attack and,
   * if the provider stops retrying on 4xx, a paying customer could end up with
   * no square at all. Replay the original answer instead.
   */
  if (input.externalOrderId) {
    const [prior] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.externalOrderId, input.externalOrderId))
      .limit(1);
    if (prior) {
      const owner = await getHolderById(db, prior.holderId);
      if (owner) {
        return {
          holder: owner,
          purchase: toPurchase(prior),
          shareBefore: prior.shareBefore === null ? null : num(prior.shareBefore),
          shareAfter: num(prior.shareAfter),
          isNew: false,
        };
      }
    }
  }

  // Read the map as it stands, so the feed can quote an honest "was → is".
  const before = buildMapState({ ...(await loadMapRows(db, now)), now });
  const existing = await getHolderByHandle(db, input.handle);
  const shareBefore =
    existing === null
      ? null
      : (before.standings.find((s) => s.holder.id === existing.id)?.share ?? 0);

  /*
   * Upsert rather than insert. The read above and this write are not in one
   * transaction, so two people claiming the same new domain at the same
   * moment both see no holder and both insert — and `holders_handle_key`
   * makes the loser throw, failing a purchase somebody already paid for.
   * ON CONFLICT resolves that in the database: the loser gets the winner's
   * row back and its purchase lands normally.
   */
  const holder =
    existing ??
    (
      await db
        .insert(holders)
        .values({
          handle: input.handle,
          url: input.url,
          tagline: input.tagline ?? input.fallbackTagline ?? null,
          email: input.email ?? null,
          // Live on payment. A square that breaks the rules is taken down by
          // flipping this column; the wall only ever renders "live".
          status: "live",
        })
        .onConflictDoUpdate({ target: holders.handle, set: { url: input.url } })
        .returning()
    ).map(toHolder)[0]!;

  /*
   * A line the buyer wrote on a top-up is an edit they asked for, so it lands.
   * A line we read off their site is not: it only ever fills an empty square at
   * creation, never replaces one somebody chose.
   */
  if (existing && input.tagline) {
    await db.update(holders).set({ tagline: input.tagline }).where(eq(holders.id, holder.id));
    holder.tagline = input.tagline;
  }

  /*
   * A top-up is a payment, not an edit. The form invites you to "enter the
   * same URL to top up", so people type the bare domain — and rewriting the
   * destination from that would quietly drop the path they actually paid for
   * and send every later click to the wrong page. It would also defeat the
   * promise on /rules that a destination cannot be swapped after the fact.
   * Changing where a square points has to be a deliberate, separate act.
   */
  // Append, then read the map back to learn what it did. shareAfter cannot be
  // known before the insert, so it is stamped in a second write.
  const [row] = await db
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

  const after = buildMapState({ ...(await loadMapRows(db, now)), now });
  const shareAfter = after.standings.find((s) => s.holder.id === holder.id)?.share ?? 0;
  await db
    .update(purchases)
    .set({ shareAfter: String(shareAfter) })
    .where(eq(purchases.id, row!.id));

  return {
    holder,
    purchase: toPurchase(row!),
    shareBefore,
    shareAfter,
    isNew: existing === null,
  };
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
