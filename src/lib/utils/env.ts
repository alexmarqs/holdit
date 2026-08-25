const parseEnvVar = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

export const serverEnv = {
  databaseUrl: parseEnvVar(process.env.DATABASE_URL),
  stripeSecretKey: parseEnvVar(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: parseEnvVar(process.env.STRIPE_WEBHOOK_SECRET),
  upstashUrl: parseEnvVar(process.env.UPSTASH_REDIS_REST_URL),
  upstashToken: parseEnvVar(process.env.UPSTASH_REDIS_REST_TOKEN),
  clickHashSalt: parseEnvVar(process.env.CLICK_HASH_SALT) ?? "holdit-dev-salt",
} as const;

export const publicEnv = {
  contactEmail:
    parseEnvVar(process.env.NEXT_PUBLIC_CONTACT_EMAIL) ?? "holdit-lol@alexandremarques.io",
} as const;

function resolveSiteUrl(): string {
  const explicit = parseEnvVar(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = parseEnvVar(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercel) return `https://${vercel}`;

  return `http://localhost:${parseEnvVar(process.env.PORT) ?? "3000"}`;
}

export const siteUrl = resolveSiteUrl();

export const isProduction = process.env.NODE_ENV === "production";
