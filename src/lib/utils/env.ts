import { env } from "@/env";

/**
 * Values derived from the validated environment. Raw variables come from
 * `@/env` directly. Server-only: `siteUrl` reads server variables, so client
 * components get what they need as props.
 */

function resolveSiteUrl(): string {
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${env.PORT ?? "3000"}`;
}

export const siteUrl = resolveSiteUrl();

export const isProduction = env.NODE_ENV === "production";
