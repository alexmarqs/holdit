import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "./env";

/**
 * Rate limiting, when Upstash is configured. When it is not, every request is
 * allowed — a missing limiter must never take the map down.
 */
const redis =
  serverEnv.upstashUrl && serverEnv.upstashToken
    ? new Redis({ url: serverEnv.upstashUrl, token: serverEnv.upstashToken })
    : null;

const limiters = new Map<string, Ratelimit>();

export interface LimitOptions {
  limit: number;
  windowSeconds: number;
}

export async function rateLimit(
  bucket: string,
  identifier: string,
  options: LimitOptions,
): Promise<{ ok: boolean; enforced: boolean }> {
  if (!redis) return { ok: true, enforced: false };

  const key = `${bucket}:${options.limit}:${options.windowSeconds}`;
  let limiter = limiters.get(key);

  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(options.limit, `${options.windowSeconds} s`),
      prefix: `holdit:${bucket}`,
    });

    limiters.set(key, limiter);
  }

  const { success } = await limiter.limit(identifier);
  return { ok: success, enforced: true };
}
