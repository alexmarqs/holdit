"use client";

import { useEffect } from "react";

/**
 * Tells the server a person is here.
 * Fall back to fetch if sendBeacon is not available.
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
