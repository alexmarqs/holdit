/**
 * Decode HTML entities in taglines scraped before the decoder understood
 * numeric forms. A tagline stored as "that&#x27;s" rendered the entity
 * literally on the wall, in the OG card and on the print card.
 *
 * Decodes in place rather than re-scraping: deterministic, needs no network,
 * and it cannot replace a line with whatever the site says today.
 *
 *   pnpm tsx --env-file=.env.local scripts/backfill-taglines.ts          # report
 *   pnpm tsx --env-file=.env.local scripts/backfill-taglines.ts --write  # apply
 *
 * Against production, point DATABASE_URL at it rather than editing .env.local.
 */
import { db } from "@holdit/db/client";
import { holders } from "@holdit/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { decodeEntities } from "@/lib/external-website-client";

const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/i;

async function main() {
  const write = process.argv.includes("--write");
  const rows = await db
    .select({ id: holders.id, handle: holders.handle, tagline: holders.tagline })
    .from(holders)
    .where(isNotNull(holders.tagline));

  let touched = 0;
  for (const row of rows) {
    if (!row.tagline || !ENTITY.test(row.tagline)) continue;
    const decoded = decodeEntities(row.tagline).replace(/\s+/g, " ").trim();
    if (decoded === row.tagline) continue;
    touched++;
    console.log(`${row.handle}\n  before: ${row.tagline}\n  after:  ${decoded}`);
    if (write) await db.update(holders).set({ tagline: decoded }).where(eq(holders.id, row.id));
  }

  console.log(
    touched === 0
      ? "\nNothing to decode."
      : `\n${touched} tagline(s) ${write ? "updated" : "would change — re-run with --write"}.`,
  );
  process.exit(0);
}

main();
