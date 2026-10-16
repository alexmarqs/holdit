"use client";

import type { Holder } from "@holdit/core";
import { ExternalLink, LocateFixed } from "lucide-react";
import { emitSquareFocus } from "@/components/map/focus-square";
import { SquareLink } from "@/components/map/square-link";
import { activityLine } from "@/components/panels/activity-copy";
import { SiteLogo } from "@/components/site-logo";
import { useWall } from "@/hooks/use-wall";
import { formatAgo, formatInt } from "@/lib/utils/format";

const rowClass =
  "group/row flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-muted/30";
const action =
  "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function RowActions({ handle, holder }: { handle: string; holder?: Holder }) {
  return (
    <span className="ml-0.5 flex shrink-0 items-center gap-0.5">
      {holder ? (
        <SquareLink
          holder={holder}
          className={action}
          aria-label={`Visit ${handle}`}
          title={`Visit ${handle}`}
        >
          <ExternalLink className="size-3.5" />
        </SquareLink>
      ) : null}
      <button
        type="button"
        className={action}
        aria-label={`Find ${handle} on the wall`}
        title="Show on the wall"
        onClick={() => emitSquareFocus(window, handle)}
      >
        <LocateFixed className="size-3.5" />
      </button>
    </span>
  );
}

/*
 * Both cards remove themselves when they have nothing to say. A heading over
 * an empty list is a hole in the page, and on launch day both would be holes
 * — the honest empty state still reads as a dead site. Trending is all-time
 * clicks, so a quiet day does not take the section down.
 */
export function TrendingCard() {
  const state = useWall();
  if (state.trending.length === 0) return null;
  const holders = new Map(
    state.standings.map((standing) => [standing.holder.handle, standing.holder]),
  );

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <h2 className="border-b border-border px-4 pt-3.5 pb-2 text-sm font-bold">🔥 Trending</h2>
      <ul>
        {state.trending.map((row) => (
          <li key={row.handle} className="border-b border-border last:border-0">
            <div className={rowClass}>
              <SiteLogo handle={row.handle} size={18} />
              <span className="truncate font-medium">{row.handle}</span>
              <span className="num ml-auto text-xs text-muted-foreground">
                {formatInt(row.clicks)}
              </span>
              <RowActions handle={row.handle} holder={holders.get(row.handle)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ActivityCard() {
  const state = useWall();
  if (state.activity.length === 0) return null;
  const holders = new Map(
    state.standings.map((standing) => [standing.holder.handle, standing.holder]),
  );

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <h2 className="border-b border-border px-4 pt-3.5 pb-2 text-sm font-bold">💵 Just bought</h2>
      <ul>
        {state.activity.slice(0, 6).map((event, index) => (
          <li
            key={event.id}
            className={`border-b border-border last:border-0 ${
              index === 0 ? "motion-safe:fresh" : ""
            }`}
          >
            <div className={rowClass}>
              <SiteLogo handle={event.handle} size={18} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{event.handle}</p>
                <p className="num text-[11px] text-muted-foreground">{activityLine(event)}</p>
              </div>
              <span className="num shrink-0 text-[11px] text-muted-foreground">
                {formatAgo(event.at, state.generatedAt)}
              </span>
              <RowActions handle={event.handle} holder={holders.get(event.handle)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
