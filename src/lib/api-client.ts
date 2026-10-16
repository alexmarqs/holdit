import type { MapState } from "@holdit/core";

/**
 * Browser calls to our own `/api` routes.
 */

export function wallStateUrl(fresh: boolean, now = Date.now()): string {
  return fresh ? `/api/state?fresh=${now}` : "/api/state";
}

export async function fetchWall(fresh = false): Promise<MapState> {
  // Fetch's default cache is "follow the headers". `/api/state` is `s-maxage=10`,
  // so a second look in this tab would reuse that copy and the wall on screen
  // would be up to ten seconds behind the one they just paid for. `no-store`
  // skips the browser cache; `?fresh=` is what skips the CDN.
  const response = await fetch(wallStateUrl(fresh), { cache: "no-store" });
  if (!response.ok) throw new Error(`Wall unavailable (${response.status})`);
  return response.json();
}

/**
 * Refresh and the post-checkout wait: a 429 or a dead origin must not replace the wall or
 * surface an error. The rate limit on `/api/state` is 10 / 10s; pressing
 * through it just keeps what they already have.
 */
export async function tryFetchWall(fresh = false): Promise<MapState | null> {
  try {
    return await fetchWall(fresh);
  } catch {
    return null;
  }
}

export type CheckoutInput = {
  target: string;
  amountCents: number;
  tagline?: string;
};

export type CheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: true; recorded: true; handle: string }
  | { ok: false; error: string };

async function startCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);
  return readCheckout(response.ok, body);
}

function readCheckout(ok: boolean, body: unknown): CheckoutResult {
  const error = readError(body);
  if (!ok) {
    return { ok: false, error: error ?? "Something went wrong. Nothing was charged." };
  }
  if (body && typeof body === "object") {
    if ("checkoutUrl" in body && typeof body.checkoutUrl === "string") {
      return { ok: true, checkoutUrl: body.checkoutUrl };
    }
    if (
      "recorded" in body &&
      body.recorded === true &&
      "handle" in body &&
      typeof body.handle === "string"
    ) {
      return { ok: true, recorded: true, handle: body.handle };
    }
  }
  return { ok: false, error: error ?? "Something went wrong. Nothing was charged." };
}

function readError(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return null;
}

/**
 * Fire and forget, in parallel with the hop. Never awaited — losing one is
 * better than making somebody wait on our counter.
 */
function logClick(holderId: string): void {
  void fetch("/api/clicks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holderId }),
    keepalive: true,
  }).catch(() => {});
}

function recordVisit(): void {
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon?.("/api/visit")) return;
  } catch {
    // Fall through to fetch.
  }
  void fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {});
}

export const apiClient = {
  fetchWall,
  tryFetchWall,
  startCheckout,
  logClick,
  recordVisit,
};
