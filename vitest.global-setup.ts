import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Brings the test database up to the current schema, once per integration run.
 *
 * Ignores `DATABASE_URL` on purpose: CI and `.env.local` point that at `holdit`,
 * the database `pnpm dev` uses. This always migrates `holdit_test` (or
 * `TEST_DATABASE_URL`), so a truncated suite cannot empty a wall you are looking
 * at. Uses the programmatic migrator rather than shelling out to drizzle-kit, so
 * a failure surfaces as a test-run error instead of a detached process's output.
 */
export default async function setup(): Promise<void> {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgres://holdit:holdit@localhost:55432/holdit_test";

  const sql = postgres(url, { max: 1, prepare: false });

  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  } catch (error) {
    throw new Error(
      `Could not prepare the test database at ${url.replace(/:[^:@]*@/, ":***@")}. ` +
        "Is it running? `pnpm db:local`.\n" +
        String(error),
    );
  } finally {
    await sql.end();
  }
}
