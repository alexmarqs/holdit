import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isProduction, serverEnv } from "@/lib/utils/env";
import { schema } from "./schema";

if (!serverEnv.databaseUrl) {
  throw new Error("DATABASE_URL is not set. Start the database with `pnpm db:local`.");
}

const sql = postgres(serverEnv.databaseUrl, {
  /*
   * Development only, and this is the price of holding the client in module
   * scope rather than on `globalThis`.
   *
   * `src/db` reaches the app through a path alias, so Next compiles it as app
   * code and re-evaluates it on edit — and each re-evaluation builds a new pool
   * while the old one keeps its sockets. postgres-js never closes an idle
   * connection by default, so those orphans accumulate until the dev server
   * restarts, and ten or so reloads is enough to exhaust `max_connections`.
   *
   * Thirty seconds is longer than an edit-and-reload cycle, so the live pool
   * stays warm while you work, and short enough that an orphan is gone before
   * the next few reloads can stack up.
   *
   * Left off in production, where there are no reloads to clean up after and a
   * timer inside a suspended serverless instance is not something to reason
   * about.
   */
  ...(isProduction ? {} : { idle_timeout: 30 }),
});

export const db = drizzle(sql, { schema, casing: "snake_case" });

export type Database = typeof db;
