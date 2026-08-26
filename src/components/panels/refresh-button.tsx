"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { sendVisitBeacon } from "@/components/visit-beacon";
import { useWall, useWallRefresh } from "@/components/wall-provider";
import { cn } from "@/lib/utils";
import { wallStaleAgo, wallStaleWarn } from "@/lib/wall-state";

const AGE_TICK_MS = 30_000;

/**
 * The one thing that asks the server for a newer wall.
 *
 * The page arrives prerendered, so what a visitor is looking at is already some
 * seconds old and then stops moving. The visitor decides when that matters.
 * Pressing Refresh skips the edge copy: the word means "the wall as it is",
 * not "a 10s cache". Settlement can still move after they leave for Stripe.
 *
 * After the tab has sat on that copy for a couple of minutes, a quiet age next
 * to the control is the nudge — not a refetch on focus, which would jump the
 * map while they were still reading. At fifteen minutes the age warms to orange;
 * red stays for errors.
 *
 * Pressing it also re-announces the visitor. The beacon otherwise fires once
 * per page load, so somebody reading the wall for ten minutes silently drops
 * out of the online count while still sitting there; a press is the one signal
 * we have that they are. The write upserts on the visitor's hash, so this can
 * never inflate the visitor total.
 */
export function RefreshButton() {
  const { generatedAt } = useWall();
  const { refresh, refreshing } = useWallRefresh();
  const [now, setNow] = useState(() => Date.now());
  const ago = wallStaleAgo(generatedAt, now);
  const warn = wallStaleWarn(generatedAt, now);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, AGE_TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <span className="inline-flex items-center gap-2">
      {ago ? (
        <span className={cn("text-[13px]", warn ? "text-warning" : "text-muted-foreground")}>
          from {ago} ago
        </span>
      ) : null}
      <Button
        variant="outline"
        size="xs"
        disabled={refreshing}
        onClick={() => {
          sendVisitBeacon();
          refresh(true);
        }}
      >
        <RotateCw className={cn(refreshing && "motion-safe:animate-spin")} aria-hidden />
        {refreshing ? "Refreshing" : "Refresh"}
      </Button>
    </span>
  );
}
