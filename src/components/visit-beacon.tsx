"use client";

import { useEffect } from "react";

/**
 * Tells the server a person is here.
 *
 * `sendBeacon` where it exists: it survives the page being closed immediately
 * and never delays anything the visitor is waiting for. The `keepalive` fetch is
 * the fallback for the same reason.
 *
 * Safe to call repeatedly. The write upserts on the visitor's hash, so a second
 * call moves `lastSeenAt` without inventing a second visitor — which is what
 * lets the refresh control count as presence.
 */
export function sendVisitBeacon(): void {
  try {
    if (navigator.sendBeacon?.("/api/visit")) return;
  } catch {
    // Fall through to fetch.
  }
  void fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {});
}

/**
 * Announces the visitor once per page load.
 *
 * Renders nothing, and a failure is silent — a counter is not worth an error.
 */
export function VisitBeacon() {
  useEffect(() => {
    sendVisitBeacon();
  }, []);

  return null;
}
