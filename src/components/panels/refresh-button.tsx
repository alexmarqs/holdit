"use client";

import { RotateCw } from "lucide-react";
import { useWallRefresh } from "@/components/map-provider";
import { Button } from "@/components/ui/button";
import { sendVisitBeacon } from "@/components/visit-beacon";
import { cn } from "@/lib/utils";

/**
 * The one thing that asks the server for a newer wall.
 *
 * The page arrives prerendered, so what a visitor is looking at is already some
 * seconds old and then stops moving. The visitor decides when that matters.
 *
 * Pressing it also re-announces the visitor. The beacon otherwise fires once
 * per page load, so somebody reading the wall for ten minutes silently drops
 * out of the online count while still sitting there; a press is the one signal
 * we have that they are. The write upserts on the visitor's hash, so this can
 * never inflate the visitor total.
 */
export function RefreshButton() {
  const { refresh, refreshing } = useWallRefresh();

  return (
    <Button
      variant="outline"
      size="xs"
      disabled={refreshing}
      onClick={() => {
        sendVisitBeacon();
        refresh();
      }}
    >
      <RotateCw className={cn(refreshing && "motion-safe:animate-spin")} aria-hidden />
      {refreshing ? "Refreshing" : "Refresh"}
    </Button>
  );
}
