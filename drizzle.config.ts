import { defineConfig } from "drizzle-kit";

/*
 * drizzle-kit runs outside Next, so nothing has loaded `.env.local` — the file
 * the README tells you to write your `DATABASE_URL` into. Without this, a
 * correctly configured checkout still fails with an empty `url`.
 * `if-exists` semantics: CI sets the variable directly and ships no file.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local — a real environment variable is expected instead.
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
