import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { isProduction } from "@/lib/utils/env";
import { schema } from "./schema";

const sql = postgres(env.DATABASE_URL, {
  /*
   * Production uses Supabase's transaction pooler. Prepared statements are
   * session-scoped and break there; the purchase transaction still runs as one
   * unit, so the advisory lock is fine.
   *
   * Development idle_timeout is the price of holding the client in module
   * scope rather than on `globalThis`. Next re-evaluates this module on edit
   * and would otherwise leave orphan sockets until `max_connections` is gone.
   * Thirty seconds outlives an edit-and-reload; production has no reloads.
   */
  ...(isProduction ? { prepare: false } : { idle_timeout: 30 }),
});

export const db = drizzle(sql, { schema, casing: "snake_case" });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Queryable = Database | Transaction;
