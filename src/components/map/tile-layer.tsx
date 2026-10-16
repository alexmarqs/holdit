"use client";

import {
  type HolderStanding,
  heatLevel,
  MIN_SHOWN_TILE_CLICKS,
  type Placed,
  tileContent,
} from "@holdit/core";
import { memo } from "react";
import { SiteLogo } from "@/components/site-logo";
import { shortHandle } from "@/lib/utils/domain";
import { formatInt, formatShare } from "@/lib/utils/format";
import { SquareLink } from "./square-link";

export interface TileLayerProps {
  tiles: Placed<{ id: string; weight: number }>[];
  byId: Map<string, HolderStanding>;
  canvas: { w: number; h: number };
  needle: string;
  flash: string | null;
  now: number;
  /**
   * A new-square preview is on the wall. Printed shares would still be
   * today's — everyone else shrinks when that square lands.
   */
  omitShare?: boolean;
  onEnter: (standing: HolderStanding) => void;
  onLeave: () => void;
  onFocusTile: (standing: HolderStanding, element: HTMLElement) => void;
}

/** The line under the handle. Share is omitted while a new preview is packed. */
export function tileStatsLine(
  share: number,
  clicks: number,
  omitShare = false,
): string | undefined {
  const clicksText = clicks >= MIN_SHOWN_TILE_CLICKS ? `${formatInt(clicks)} clicks` : undefined;
  if (omitShare) return clicksText;
  const shareText = formatShare(share);
  return clicksText ? `${shareText} · ${clicksText}` : shareText;
}

const TILE_GAP = 1;

/** Gutters sit between tiles, not on the canvas edge — that strip read as padding. */
export function tileBox(
  tile: { x: number; y: number; w: number; h: number },
  canvas: { w: number; h: number },
) {
  const atRight = tile.x + tile.w >= canvas.w - 1;
  const atBottom = tile.y + tile.h >= canvas.h - 1;
  return {
    x: tile.x,
    y: tile.y,
    w: Math.max(0, tile.w - (atRight ? 0 : TILE_GAP)),
    h: Math.max(0, tile.h - (atBottom ? 0 : TILE_GAP)),
  };
}

/**
 * The tiles, memoised away from hover state.
 *
 * Hover styling is pure CSS, so nothing here needs to re-render when the
 * pointer moves — which is what keeps a five-hundred-square map responsive.
 */
export const TileLayer = memo(function TileLayer({
  tiles,
  byId,
  canvas,
  needle,
  flash,
  now,
  omitShare = false,
  onEnter,
  onLeave,
  onFocusTile,
}: TileLayerProps) {
  return (
    <>
      {tiles.map((tile) => {
        const standing = byId.get(tile.id);
        if (!standing) return null;
        const box = tileBox(tile, canvas);
        const handle = standing.holder.handle;
        // The strings the tile will actually print, so their wrapped height is
        // part of the fit decision rather than an afterthought.
        // All-time clicks, and only once there are enough of them to be worth
        // printing. "2 clicks" on a square reads as nobody goes there.
        const statsText = tileStatsLine(standing.share, standing.clicksAllTime, omitShare);
        const face = tileContent(tile.w, tile.h, {
          short: shortHandle(handle),
          full: handle,
          stats: statsText,
          tagline: standing.holder.tagline,
        });
        const hit = needle.length > 0 && standing.holder.handle.toLowerCase().includes(needle);

        return (
          <SquareLink
            key={tile.id}
            holder={standing.holder}
            className="tile"
            data-spine={face.spine}
            data-tiny={face.name === null && !face.spine}
            data-match={hit}
            data-dim={needle.length > 0 && !hit}
            data-flash={flash === standing.holder.handle}
            style={{
              transform: `translate(${box.x}px, ${box.y}px)`,
              width: box.w,
              height: box.h,
              ["--heat" as string]: heatLevel(standing.lastPurchaseAt, now).toFixed(3),
            }}
            // No `title`: the browser's native tooltip would appear on top of the
            // panel the map already shows. aria-label keeps it announced.
            aria-label={standing.holder.handle}
            onMouseEnter={() => onEnter(standing)}
            onMouseLeave={onLeave}
            onFocus={(event) => onFocusTile(standing, event.currentTarget)}
            onBlur={onLeave}
          >
            <SiteLogo
              handle={handle}
              size={face.logoPx}
              className={face.spine || face.name === null ? "rounded-[2px]" : undefined}
            />
            {face.spine ? (
              <p className="tile-spine-name">{handle}</p>
            ) : (
              <>
                {face.name !== null ? (
                  <p
                    className={`mt-1.5 font-bold tracking-[-0.02em] ${face.nameClipped ? "truncate" : ""}`}
                    style={{ fontSize: face.nameFontPx }}
                  >
                    {face.name}
                  </p>
                ) : null}
                {face.stats ? <p className="num mt-0.5 text-xs opacity-70">{statsText}</p> : null}
                {face.taglineLines > 0 && standing.holder.tagline ? (
                  <p
                    className="mt-2 overflow-hidden text-xs leading-snug opacity-70"
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: face.taglineLines,
                    }}
                  >
                    {standing.holder.tagline}
                  </p>
                ) : null}
              </>
            )}
          </SquareLink>
        );
      })}
    </>
  );
});
