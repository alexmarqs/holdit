/**
 * Environment access, in one place, with the optionality made explicit.
 *
 * Reading a value never throws here. Most integrations then degrade: no Stripe
 * key means a local purchase, no Upstash means no rate limiting.
 *
 * `DATABASE_URL` is the exception, and the only one. There is no second backend
 * to fall back to, so `database()` refuses rather than inventing a wall — see
 * `db/client.ts`. Run `pnpm db:local` for a local one.
 */

const str = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

export const serverEnv = {
  databaseUrl: str(process.env.DATABASE_URL),
  /*
   * Stripe, not a merchant of record. That means this project is the merchant:
   * tax registration and remittance, and liability to the card networks, sit
   * here rather than with the processor.
   */
  stripeSecretKey: str(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: str(process.env.STRIPE_WEBHOOK_SECRET),
  upstashUrl: str(process.env.UPSTASH_REDIS_REST_URL),
  upstashToken: str(process.env.UPSTASH_REDIS_REST_TOKEN),
  clickHashSalt: str(process.env.CLICK_HASH_SALT) ?? "holdit-dev-salt",
} as const;

/** Referenced statically so Next can inline them into the client bundle. */
export const publicEnv = {
  /**
   * Where takedowns and refunds are reported. The rules promise squares come
   * down "when somebody reports it", which is only a promise if there is
   * somewhere to report it to.
   */
  contactEmail: str(process.env.NEXT_PUBLIC_CONTACT_EMAIL) ?? "hello@holdit.lol",
} as const;

/**
 * The site's own origin, used for canonicals, OG URLs, the sitemap, JSON-LD ids
 * and the checkout return URL.
 *
 * Resolved rather than hardcoded, in this order:
 *
 *  1. `NEXT_PUBLIC_APP_URL` — an explicit setting always wins.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL` — the stable production domain, set
 *     automatically. Deliberately not `VERCEL_URL`, which changes every deploy
 *     and would point canonicals at a throwaway hostname.
 *  3. localhost on whatever port is actually in use — a fixed :3000 was wrong
 *     the moment the dev server picked another one.
 *
 * Server-only: it reads variables Next does not inline into the browser bundle,
 * so it must not be read from a client component.
 */
export const siteUrl = (() => {
  const explicit = str(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = str(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercel) return `https://${vercel}`;

  return `http://localhost:${str(process.env.PORT) ?? "3000"}`;
})();

export const isProduction = process.env.NODE_ENV === "production";
