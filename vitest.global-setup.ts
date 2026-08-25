import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Brings the test database up to the current schema, once per run.
 *
 * Uses the programmatic migrator rather than shelling out to drizzle-kit, so a
 * failure surfaces as a test-run error instead of a detached process's output.
 */
export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set for the test run.");

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
