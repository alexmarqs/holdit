"use client";

import { halvesAt, MIN_SHOWN_CLICKS, MIN_SHOWN_VISITORS } from "@holdit/core";
import { Hourglass } from "lucide-react";
import type { ReactNode } from "react";
import { RefreshButton } from "@/components/panels/refresh-button";
import { useWall } from "@/components/wall-provider";
import { cn } from "@/lib/utils";
import { formatHalfDate, formatInt, formatMoney } from "@/lib/utils/format";

/**
 * Publishing your own numbers is the cheapest credibility move available, and
 * it doubles as the sales page. Anything that cannot be measured is left out
 * rather than estimated.
 */
export function CounterStrip() {
  const state = useWall();
  const { counters } = state;

  return (
    <div className="border-b border-border/80 bg-card/70">
      {/*
        The numbers are text, not one big link. A full-width anchor navigates on
        a stray click and makes the figures impossible to select or copy.
      */}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-y-1 px-4 py-2 text-[13px] lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5">
        {/*
          Narrow: stats and Refresh on one row, half-life as a caption under them.
          Wide: the current single row — online, live, caption, clicks, visitors,
          Refresh at the end. `lg:contents` lifts the stats into that row so the
          caption can sit after the live total instead of wrapping as a fourth
          equal block.
        */}
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-5 gap-y-1 lg:contents">
          {(counters.onlineNow ?? 0) > 0 ? (
            <span className="flex items-center gap-1.5 font-medium text-live lg:order-1">
              <span aria-hidden className="size-1.5 rounded-full bg-live motion-safe:blip" />
              <span className="num">{formatInt(counters.onlineNow ?? 0)}</span> online
            </span>
          ) : null}

          <Stat
            className="lg:order-2"
            value={formatMoney(counters.liveCents)}
            label="live"
            tone="accent"
          />

          {counters.clicksAllTime >= MIN_SHOWN_CLICKS ? (
            <Stat className="lg:order-4" value={formatInt(counters.clicksAllTime)} label="clicks" />
          ) : null}
          {counters.visitorsSinceLaunch >= MIN_SHOWN_VISITORS ? (
            <Stat
              className="lg:order-5"
              value={formatInt(counters.visitorsSinceLaunch)}
              label="visitors"
            />
          ) : null}

          {/*
            Last on this row, and last on the wide row: the figures are the
            point, and the control that updates them is the footnote. Header is
            nav; the buy panel is pay. Refresh belongs with the numbers it
            rewrites.
          */}
          <span className="ml-auto shrink-0 lg:order-6">
            <RefreshButton />
          </span>
        </div>

        {counters.liveCents > 0 ? <HalfLifeCaption now={state.generatedAt} /> : null}
      </div>
    </div>
  );
}

function HalfLifeCaption({ now }: { now: number }) {
  const when = formatHalfDate(halvesAt(now));

  return (
    <span className="order-last max-w-xl text-pretty text-muted-foreground lg:order-3">
      <Hourglass className="mb-px mr-1 inline size-3.5 align-text-bottom" aria-hidden />
      If nobody buys, this live total is half on <span className="num text-foreground">{when}</span>
      . The wall does not change.
    </span>
  );
}

/** Number emphasised, label quiet — so the row scans as a dashboard, not a sentence. */
function Stat({
  value,
  label,
  tone = "default",
  className,
}: {
  value: ReactNode;
  label: string;
  tone?: "default" | "accent";
  className?: string;
}) {
  return (
    <span className={cn("flex items-baseline gap-1.5 text-muted-foreground", className)}>
      <span
        className={cn("num font-medium", tone === "accent" ? "text-primary" : "text-foreground")}
      >
        {value}
      </span>
      {label}
    </span>
  );
}
