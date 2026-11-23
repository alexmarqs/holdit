import { z } from "zod";
import { loadEnvConfig } from "zod-config/nextjs";

/**
 * Every environment variable the app reads. Validated when Next.js loads its
 * config (`next dev`, `next build`, `next start`, via `withZodConfigEnv` in
 * `next.config.ts`), then again in each runtime the first time this module is
 * imported. Empty values count as unset, so the blanks in `.env.example` fall
 * through to the optional/default branches below.
 */
export const env = loadEnvConfig({
  server: {
    DATABASE_URL: z.url(),

    // Optional: without them the webhook answers 503, and checkout answers 503 in
    // production or records the purchase directly (no payment) in development.
    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

    // Optional: rate limiting is a no-op unless both are set.
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    CLICK_HASH_SALT: z.string().default("holdit-dev-salt"),

    // Set by the platform, used to work out the site URL.
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
    PORT: z.string().regex(/^\d+$/).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z
      .url()
      .transform((url) => url.replace(/\/$/, ""))
      .optional(),
    NEXT_PUBLIC_CONTACT_EMAIL: z.email().default("holdit-lol@alexandremarques.io"),
  },
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    NODE_ENV: process.env.NODE_ENV,
  },
});
