"use client";

import { MIN_SHOWN_TILE_CLICKS } from "@holdit/core";
import { ExternalLink, LocateFixed } from "lucide-react";
import { useState } from "react";
import { LiveWord } from "@/components/live-word";
import { emitSquareFocus } from "@/components/map/focus-square";
import { SquareLink } from "@/components/map/square-link";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { useWall } from "@/hooks/use-wall";
import { formatAgo, formatInt, formatMoney, formatShare } from "@/lib/utils/format";

const PAGE = 20;

const action =
  "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

/**
 * The same squares as the map, read as a list. The map is the picture; this is
 * where a buyer reads the taglines and compares spend. Absent until the first
 * square exists — an empty list under a heading is a hole, not a pitch.
 */
export function Listing() {
  const state = useWall();
  const [shown, setShown] = useState(PAGE);
  const rows = state.standings.slice(0, shown);

  if (state.standings.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <h2 className="border-b border-border px-4 pt-3.5 pb-2 text-sm font-bold">Every square</h2>
      <ul>
        {rows.map((standing) => (
          <li key={standing.holder.id} className="border-b border-border last:border-0">
            <div className="group/row flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30">
              <SiteLogo handle={standing.holder.handle} size={36} className="mt-0.5 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="truncate font-medium">{standing.holder.handle}</span>
                  <span className="num ml-auto shrink-0 font-bold text-primary">
                    {formatShare(standing.share)}
                  </span>
                </div>
                {standing.holder.tagline ? (
                  <p className="mt-0.5 line-clamp-3 text-sm leading-snug text-pretty text-muted-foreground">
                    {standing.holder.tagline}
                  </p>
                ) : null}
                <p className="num mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    {formatMoney(standing.liveCents)} <LiveWord />
                  </span>
                  <span>{formatMoney(standing.allTimeCents)} all time</span>
                  {standing.clicksAllTime >= MIN_SHOWN_TILE_CLICKS ? (
                    <span>{formatInt(standing.clicksAllTime)} clicks</span>
                  ) : null}
                  {standing.lastPurchaseAt !== null ? (
                    <span>bought {formatAgo(standing.lastPurchaseAt, state.generatedAt)}</span>
                  ) : null}
                  {standing.capped ? (
                    <span
                      className="text-primary"
                      title="At the max size. More spend keeps you there when others buy"
                    >
                      max size
                    </span>
                  ) : null}
                </p>
              </div>
              <span className="mt-0.5 ml-0.5 flex shrink-0 items-center gap-0.5">
                <SquareLink
                  holder={standing.holder}
                  className={action}
                  aria-label={`Visit ${standing.holder.handle}`}
                  title={`Visit ${standing.holder.handle}`}
                >
                  <ExternalLink className="size-3.5" />
                </SquareLink>
                <button
                  type="button"
                  className={action}
                  aria-label={`Find ${standing.holder.handle} on the wall`}
                  title="Show on the wall"
                  onClick={() => emitSquareFocus(window, standing.holder.handle)}
                >
                  <LocateFixed className="size-3.5" />
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {shown < state.standings.length ? (
        <div className="flex justify-center border-t border-border py-2">
          <Button variant="ghost" size="xs" onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, state.standings.length - shown)} more
          </Button>
        </div>
      ) : null}
    </section>
  );
}
