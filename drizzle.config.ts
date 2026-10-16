import { defineConfig } from "drizzle-kit";

/*
 * drizzle-kit runs outside Next, so nothing has loaded `.env.local`
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
