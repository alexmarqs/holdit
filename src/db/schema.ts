import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The whole schema. Everything the product shows is derived from it — there is
 * no game table, no expires_at, no version counter, no queue.
 */

export const holders = pgTable(
  "holders",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Bare domain or @handle. The identity of a square; there are no accounts. */
    handle: text().notNull(),
    url: text().notNull(),
    tagline: text(),
    /**
     * Only "live" is rendered. Every insert sets it explicitly — nothing is
     * reviewed before going up — so this default is unreachable from the app
     * and exists so that an unforeseen insert path fails closed.
     */
    status: text().notNull().default("pending"),
    /** Arrives with the payment. Owner-only; no query exposes it. */
    email: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("holders_handle_key").on(t.handle), index("holders_status_idx").on(t.status)],
);

export const purchases = pgTable(
  "purchases",
  {
    id: uuid().primaryKey().defaultRandom(),
    holderId: uuid()
      .notNull()
      .references(() => holders.id, { onDelete: "cascade" }),
    /** What was paid. The only quantity the map is built from. */
    amountCents: integer().notNull(),
    /**
     * Share either side of this purchase, captured at write time. Stored rather
     * than recomputed because the activity feed quotes a historical share, and
     * history should not move.
     */
    shareBefore: numeric({ precision: 10, scale: 8 }),
    shareAfter: numeric({ precision: 10, scale: 8 }).notNull(),
    provider: text().notNull().default("stripe"),
    externalOrderId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    refundedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("purchases_holder_created_idx").on(t.holderId, t.createdAt),
    index("purchases_created_idx").on(t.createdAt),
    uniqueIndex("purchases_external_order_key").on(t.externalOrderId),
  ],
);

export const clicks = pgTable(
  "clicks",
  {
    id: uuid().primaryKey().defaultRandom(),
    holderId: uuid()
      .notNull()
      .references(() => holders.id, { onDelete: "cascade" }),
    ts: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Salted hash. Enough to dedupe, not enough to identify. */
    ipHash: text().notNull(),
    referrer: text(),
    uaClass: text().notNull().default("unknown"),
  },
  (t) => [
    index("clicks_holder_ts_idx").on(t.holderId, t.ts),
    index("clicks_dedupe_idx").on(t.holderId, t.ipHash, t.ts),
  ],
);

/** One row per distinct visitor, so the launch counter is a plain count. */
export const visits = pgTable(
  "visits",
  {
    visitorHash: text().primaryKey(),
    firstSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visits_last_seen_idx").on(t.lastSeenAt)],
);

export const schema = { holders, purchases, clicks, visits };
