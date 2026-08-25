import type { Holder, Purchase } from "@holdit/core";
import type { holders, purchases } from "./schema";

/**
 * Row shapes to domain shapes. One place, because every query returns these two
 * and the app should never see a `Date` or a numeric-as-string.
 */

export const num = (value: string | null) => (value === null ? 0 : Number(value));

export function toHolder(row: typeof holders.$inferSelect): Holder {
  return {
    id: row.id,
    handle: row.handle,
    url: row.url,
    tagline: row.tagline,
    status: row.status as Holder["status"],
    createdAt: row.createdAt.getTime(),
  };
}

export function toPurchase(row: typeof purchases.$inferSelect): Purchase {
  return {
    id: row.id,
    holderId: row.holderId,
    amountCents: row.amountCents,
    createdAt: row.createdAt.getTime(),
    refundedAt: row.refundedAt?.getTime() ?? null,
  };
}
