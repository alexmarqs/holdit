import { CLICK_DEDUPE_WINDOW_MS } from "@holdit/core";
import { and, eq, gte, sql } from "drizzle-orm";
import { classifyUserAgent, hashIp } from "@/lib/utils/hash";
import type { Database } from "../client";
import { clicks } from "../schema";

export interface TrackClickInput {
  holderId: string;
  ip: string;
  userAgent: string | null;
  referrer: string | null;
}

/**
 * Click counts never affect area, so nothing here defends the map. They do rank
 * the Trending card, which is the one thing a click buys and the reason the
 * dedupe window exists — "informational only, so there is nothing to farm for"
 * was the old justification here and it was not true while Trending shipped.
 *
 * Dedupe is one per address per holder per `CLICK_DEDUPE_WINDOW_MS`, bots are
 * classified out, and the raw rows stay owner-only.
 */
export async function trackClick(
  db: Database,
  input: TrackClickInput,
  now = Date.now(),
): Promise<{ counted: boolean }> {
  const ipHash = hashIp(input.ip);
  const uaClass = classifyUserAgent(input.userAgent);
  const since = new Date(now - CLICK_DEDUPE_WINDOW_MS);

  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clicks)
    .where(
      and(eq(clicks.holderId, input.holderId), eq(clicks.ipHash, ipHash), gte(clicks.ts, since)),
    );

  const counted = (recent?.n ?? 0) === 0 && uaClass === "browser";
  await db.insert(clicks).values({
    holderId: input.holderId,
    ipHash,
    referrer: input.referrer,
    // A duplicate is logged as such rather than dropped, so it stays auditable.
    uaClass: counted ? uaClass : uaClass === "browser" ? "duplicate" : uaClass,
    ts: new Date(now),
  });

  return { counted };
}
