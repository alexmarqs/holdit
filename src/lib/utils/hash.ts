import { createHash } from "node:crypto";
import { serverEnv } from "./env";

/**
 * Click logs keep a salted hash rather than an address. Enough to dedupe one
 * visitor per holder during the configured dedupe window, not enough to
 * identify anyone.
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${serverEnv.clickHashSalt}:${ip}`).digest("hex").slice(0, 32);
}

/** Coarse UA buckets. Bots are logged and excluded, never silently dropped. */
export function classifyUserAgent(ua: string | null): "browser" | "bot" | "unknown" {
  if (!ua) return "unknown";
  const lower = ua.toLowerCase();
  if (/bot|crawler|spider|curl|wget|python-requests|headless|preview|scanner|monitor/.test(lower)) {
    return "bot";
  }
  return /mozilla|safari|chrome|firefox|edge|opera/.test(lower) ? "browser" : "unknown";
}
