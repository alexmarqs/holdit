"use client";

import { type HolderStanding, MIN_SHOWN_TILE_CLICKS } from "@holdit/core";
import { formatAgo, formatInt, formatMoney, formatShare } from "@holdit/utils/format";
import type { RefObject } from "react";
import { SiteLogo } from "@/components/site-logo";

export interface HoverTarget {
  standing: HolderStanding;
}

/**
 * Positioned imperatively by the map through `elementRef`, never by React.
 *
 * The cursor moves at input rate; re-rendering to follow it would put the
 * tooltip a frame behind and force a layout pass per pixel. Content changes
 * only when the hovered square changes, so React does no per-pixel work.
 */
export function MapTooltip({
  target,
  now,
  elementRef,
}: {
  target: HoverTarget | null;
  now: number;
  elementRef: RefObject<HTMLDivElement | null>;
}) {
  /*
   * Rows are dropped, not zeroed. A stat block of noughts reads as a dead
   * square, and on a new wall every square would have one.
   */
  const rows: [string, string][] = !target
    ? []
    : ([
        ["Share", formatShare(target.standing.share)],
        ["Counting", formatMoney(target.standing.liveCents)],
        ["All time", formatMoney(target.standing.allTimeCents)],
        target.standing.clicksAllTime >= MIN_SHOWN_TILE_CLICKS
          ? (["Clicks", formatInt(target.standing.clicksAllTime)] as const)
          : null,
        [
          "Last bought",
          target.standing.lastPurchaseAt === null
            ? "never"
            : formatAgo(target.standing.lastPurchaseAt, now),
        ],
      ].filter(Boolean) as [string, string][]);

  return (
    <div
      ref={elementRef}
      role="status"
      // Kept mounted so there is nothing to construct on the first move.
      // translate3d only: no layout, compositor-only updates.
      className="pointer-events-none fixed top-0 left-0 z-50 w-[190px] rounded-lg border border-border bg-popover px-2.5 py-2 text-popover-foreground shadow-sm will-change-transform"
      style={{ visibility: target ? "visible" : "hidden" }}
    >
      {target ? (
        <>
          <p className="flex items-center gap-1.5 text-[13px] leading-none font-bold">
            <SiteLogo handle={target.standing.holder.handle} size={15} />
            <span className="truncate">{target.standing.holder.handle}</span>
          </p>
          {/* Rows sit on a tight 15px rhythm. Each is one short label and one
              number, so the panel reads as a stat block rather than prose. */}
          <dl className="mt-1.5 border-t border-border/60 pt-1.5">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-2 text-[11px] leading-[15px]">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="num ml-auto font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </div>
  );
}
