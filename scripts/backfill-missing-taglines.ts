/**
 * Fetch site-published descriptions for live holders that do not have one.
 *
 * Dry-run by default. A handle can be supplied to repair one square without
 * visiting every missing site:
 *
 *   pnpm taglines:backfill -- --handle=ramp.com
 *   pnpm taglines:backfill -- --handle=ramp.com --write
 *
 * Against production, point DATABASE_URL at it rather than editing .env.local.
 * The guarded update never replaces a description written concurrently.
 */
import { db } from "@holdit/db/client";
import { holders } from "@holdit/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { externalWebsiteClient } from "@/lib/external-website-client";

async function main() {
  const write = process.argv.includes("--write");
  const handle = process.argv.find((arg) => arg.startsWith("--handle="))?.slice("--handle=".length);
  const missing = and(
    eq(holders.status, "live"),
    isNull(holders.tagline),
    handle ? eq(holders.handle, handle) : undefined,
  );
  const rows = await db
    .select({ id: holders.id, handle: holders.handle, url: holders.url })
    .from(holders)
    .where(missing);

  let found = 0;
  for (const row of rows) {
    const tagline = await externalWebsiteClient.fetchSiteInfo(row.handle, row.url, null);
    if (!tagline) {
      console.log(`${row.handle}\n  no published description found`);
      continue;
    }

    found++;
    console.log(`${row.handle}\n  ${tagline}`);
    if (write) {
      await db
        .update(holders)
        .set({ tagline })
        .where(and(eq(holders.id, row.id), isNull(holders.tagline)));
    }
  }

  console.log(
    found === 0
      ? "\nNo missing descriptions found."
      : `\n${found} description(s) ${write ? "updated" : "found — re-run with --write"}.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
