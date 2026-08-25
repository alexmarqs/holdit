"use client";

import { halvesAt, MIN_SHOWN_CLICKS, MIN_SHOWN_VISITORS } from "@holdit/core";
import { useAtomValue } from "jotai";
import { Hourglass } from "lucide-react";
import type { ReactNode } from "react";
import { wallAtom } from "@/components/map-provider";
import { RefreshButton } from "@/components/panels/refresh-button";
import { cn } from "@/lib/utils";
import { formatHalfDate, formatInt, formatMoney } from "@/lib/utils/format";

/**
 * Publishing your own numbers is the cheapest credibility move available, and
 * it doubles as the sales page. Anything that cannot be measured is left out
 * rather than estimated.
 */
export function CounterStrip() {
  const state = useAtomValue(wallAtom);
  const { counters } = state;

  return (
    <div className="border-b border-border/80 bg-card/70">
      {/*
        The numbers are text, not one big link. A full-width anchor navigates on
        a stray click and makes the figures impossible to select or copy.
      */}
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-y-1 px-4 py-2 text-center text-[13px] lg:flex-row lg:flex-wrap lg:items-center lg:justify-start lg:gap-x-5 lg:text-left">
        {/*
          A small counter is worse than an absent one. On launch day this row
          would read "0 online · 0 clicks · 0 visitors", which invites a verdict
          on the wall before anyone has looked at it. Clicks and visitors wait
          until they carry their own weight. The live total always shows —
          that is the wall itself. Online only waits out zero: anybody reading
          this made it true, so there is nothing to be shy about at one.
          Square count lives on the map.
        */}
        {(counters.onlineNow ?? 0) > 0 ? (
          <span className="flex items-center gap-1.5 font-medium text-live">
            <span aria-hidden className="size-1.5 rounded-full bg-live motion-safe:blip" />
            <span className="num">{formatInt(counters.onlineNow ?? 0)}</span> online
          </span>
        ) : null}

        <LiveStat cents={counters.liveCents} now={state.generatedAt} />
        {/* All-time, not today: a young wall's "today" resets to nothing every
            morning, which reads as decline rather than as a fresh start. */}
        {counters.clicksAllTime >= MIN_SHOWN_CLICKS ? (
          <Stat value={formatInt(counters.clicksAllTime)} label="clicks" />
        ) : null}
        {counters.visitorsSinceLaunch >= MIN_SHOWN_VISITORS ? (
          <Stat value={formatInt(counters.visitorsSinceLaunch)} label="visitors" />
        ) : null}

        {/* Last, and pushed to the far end on wide screens: the figures are the
            point of this row, and the control that updates them is the footnote. */}
        <span className="lg:ml-auto">
          <RefreshButton />
        </span>
      </div>
    </div>
  );
}

function LiveStat({ cents, now }: { cents: number; now: number }) {
  if (cents <= 0) {
    return <Stat value={formatMoney(0)} label="live" tone="accent" />;
  }

  const when = formatHalfDate(halvesAt(now));

  return (
    <>
      <Stat value={formatMoney(cents)} label="live" tone="accent" />
      <span className="max-w-xl text-pretty text-muted-foreground">
        <Hourglass className="mb-px mr-1 inline size-3.5 align-text-bottom" aria-hidden />
        If nobody buys, this live total is half on{" "}
        <span className="num text-foreground">{when}</span>. The wall does not change.
      </span>
    </>
  );
}

/** Number emphasised, label quiet — so the row scans as a dashboard, not a sentence. */
function Stat({
  value,
  label,
  tone = "default",
}: {
  value: ReactNode;
  label: string;
  tone?: "default" | "accent";
}) {
  return (
    <span className="flex items-baseline gap-1.5 text-muted-foreground">
      <span
        className={cn("num font-medium", tone === "accent" ? "text-primary" : "text-foreground")}
      >
        {value}
      </span>
      {label}
    </span>
  );
}
