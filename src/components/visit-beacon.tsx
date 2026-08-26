"use client";

import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";

/**
 * Tells the server a person is here.
 * Fall back to fetch if sendBeacon is not available.
 */
export function sendVisitBeacon(): void {
  apiClient.recordVisit();
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
