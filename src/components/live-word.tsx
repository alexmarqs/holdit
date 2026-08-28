"use client";

import { HALF_LIFE_DAYS } from "@holdit/core";
import { Info } from "lucide-react";
import { useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export const LIVE_SPEND_HREF = "/rules#live-spend";

/** Pause so the pointer can reach the panel (and the rules link). */
const HOVER_CLOSE_MS = 160;

/** The live-spend rule, in the same terms as `/rules`. */
export function liveSpendHint(halfLifeDays: number): string {
  return `Live spend is what sizes the square. It halves every ${halfLifeDays} days if nobody buys. All-time does not fade. Share only moves when someone else pays.`;
}

/** One line for tight surfaces that cannot host the info control. */
export function liveSpendHintShort(halfLifeDays: number): string {
  return `Halves every ${halfLifeDays} days if nobody buys.`;
}

/**
 * The word "live" plus a small info control that explains decay and sends
 * the rest of the reading to the rules.
 *
 * A native `title` cannot hold a link. The map hover panel is
 * `pointer-events-none` and tracks the cursor, so it uses the short line
 * instead of this control. Positioning, dismiss, and collision are rented
 * from Radix HoverCard. The trigger is the icon, not the word. A tap still
 * toggles — HoverCard ignores touch hover so a finger is not a hover.
 */
export function LiveWord({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={0} closeDelay={HOVER_CLOSE_MS}>
      <span className={cn("inline-flex items-center gap-0.5", className)}>
        live
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="-m-0.5 inline-flex size-4 cursor-pointer items-center justify-center rounded-sm text-muted-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="What live spend means"
            onPointerUp={(event) => {
              if (event.pointerType !== "touch") return;
              setOpen((current) => !current);
            }}
          >
            <Info className="size-3" strokeWidth={2.25} />
          </button>
        </HoverCardTrigger>
      </span>
      <HoverCardContent>
        <p>{liveSpendHint(HALF_LIFE_DAYS)}</p>
        <p className="mt-1.5">
          <a href={LIVE_SPEND_HREF} className="font-medium text-primary hover:text-primary/80">
            More in the rules
          </a>
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
