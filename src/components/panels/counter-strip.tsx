"use client";

import { MIN_SHOWN_CLICKS, MIN_SHOWN_VISITORS } from "@holdit/core";
import type { ReactNode } from "react";
import { LiveWord } from "@/components/live-word";
import { useWall } from "@/hooks/use-wall";
import { formatInt, formatMoney } from "@/lib/utils/format";

/** A person looking at this hydrated page makes the visible count at least one. */
export const visibleOnlineCount = (onlineNow: number | null | undefined): number => {
  return Math.max(1, onlineNow ?? 0);
};

/**
 * Publishing your own numbers is the cheapest credibility move available.
 * Anything that cannot be measured is left out rather than estimated.
 */
export function StatsPill() {
  const { counters } = useWall();
  const parts: { key: string; node: ReactNode }[] = [];
  const onlineNow = visibleOnlineCount(counters.onlineNow);

  parts.push({
    key: "online",
    node: (
      <span className="inline-flex items-center gap-1.5 font-medium text-live">
        <span aria-hidden className="size-1.5 rounded-full bg-live motion-safe:blip" />
        <span className="num">{formatInt(onlineNow)}</span> online
      </span>
    ),
  });

  parts.push({
    key: "live",
    node: (
      <span>
        <span className="num font-medium text-foreground">{formatMoney(counters.liveCents)}</span>{" "}
        <LiveWord />
      </span>
    ),
  });

  if (counters.squaresLive > 0) {
    parts.push({
      key: "squares",
      node: (
        <span>
          <span className="num font-medium text-foreground">{formatInt(counters.squaresLive)}</span>{" "}
          {counters.squaresLive === 1 ? "square" : "squares"}
        </span>
      ),
    });
  }

  if (counters.clicksAllTime >= MIN_SHOWN_CLICKS) {
    parts.push({
      key: "clicks",
      node: (
        <span>
          <span className="num font-medium text-foreground">
            {formatInt(counters.clicksAllTime)}
          </span>{" "}
          clicks
        </span>
      ),
    });
  }

  if (counters.visitorsSinceLaunch >= MIN_SHOWN_VISITORS) {
    parts.push({
      key: "visitors",
      node: (
        <span>
          <span className="num font-medium text-foreground">
            {formatInt(counters.visitorsSinceLaunch)}
          </span>{" "}
          visitors
        </span>
      ),
    });
  }

  return (
    <p className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 rounded-full bg-card px-3 py-1.5 text-[12px] leading-none text-muted-foreground shadow-sm ring-1 ring-foreground/15">
      {parts.map((part, index) => (
        <span key={part.key} className="inline-flex items-center gap-x-2">
          {index > 0 ? <span aria-hidden>·</span> : null}
          {part.node}
        </span>
      ))}
    </p>
  );
}
