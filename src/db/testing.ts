import { sql } from "drizzle-orm";
import { resetMapRowsCache } from "./queries/map";
import { db } from "./client";

/**
 * How a suite starts from nothing.
 *
 * One connection for the whole run — the client is a module-level singleton —
 * and every suite truncates in `beforeEach`. Integration files run one at a time
 * (`fileParallelism` is off on that Vitest project) because they share this
 * database, so a truncation in one file would otherwise land in the middle of
 * another.
 *
 * Takes no arguments on purpose: `beforeEach(resetDatabase)` hands the callback
 * vitest's test context, and a `db` parameter would silently receive it.
 */
export async function resetDatabase(): Promise<void> {
  // CASCADE covers the foreign keys from clicks and purchases back to holders.
  await db.execute(sql`truncate table holders, purchases, clicks, visits cascade`);
  // The in-flight collapse in getMapState would otherwise answer the next test
  // from a load started before the truncation.
  resetMapRowsCache();
}
