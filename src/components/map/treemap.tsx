"use client";

import { computeShares, type HolderStanding, previewContent, shareAfterSpend } from "@holdit/core";
import { useAtomValue } from "jotai";
import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshButton } from "@/components/panels/refresh-button";
import { Button } from "@/components/ui/button";
import {
  flashAtom,
  mapPreviewOnAtom,
  mapSearchAtom,
  previewAtom,
  previewHandleAtom,
} from "@/context/wall-atoms";
import { useWall } from "@/hooks/use-wall";
import { cn } from "@/lib/utils";
import { formatMoney, formatShare } from "@/lib/utils/format";
import { DownloadWallButton } from "./download-wall";
import { MapSearch } from "./map-search";
import { type HoverTarget, MapTooltip } from "./map-tooltip";
import { placeWall } from "./place-wall";
import { mapPreviewActive } from "./preview";
import { PreviewSwitch } from "./preview-switch";
import { ShareWallButton } from "./share-wall";
import { TileLayer, type TileLayerProps, tileBox } from "./tile-layer";

const TOOLTIP_W = 190;
const TOOLTIP_H = 122;

/**
 * The map. Every square on one canvas, area proportional to its share.
 */
export function Treemap() {
  const state = useWall();
  const flash = useAtomValue(flashAtom);
  const preview = useAtomValue(previewAtom);
  const previewHandle = useAtomValue(previewHandleAtom);
  const wantPreview = useAtomValue(mapPreviewOnAtom);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const shell = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  const cursor = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /*
   * Flip rather than clamp. Clamping keeps the panel on screen by sliding it
   * back over the cursor — so near an edge it parked itself on top of the very
   * squares you were trying to read. Flipping to the other side of the pointer
   * puts it in the space that exists instead, and only clamps as a last resort.
   */
  const place = useCallback((x: number, y: number) => {
    const element = tooltip.current;
    if (!element) return;
    const gap = 14;
    const right = x + gap + TOOLTIP_W <= window.innerWidth - 8;
    const below = y + gap + TOOLTIP_H <= window.innerHeight - 8;
    const left = right ? x + gap : Math.max(8, x - gap - TOOLTIP_W);
    const top = below ? y + gap : Math.max(8, y - gap - TOOLTIP_H);
    element.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  }, []);

  // One delegated listener, coalesced to a frame. No React state per pixel.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;

    const onMove = (event: MouseEvent) => {
      cursor.current = { x: event.clientX, y: event.clientY };
      if (pending.current !== null) return;
      pending.current = requestAnimationFrame(() => {
        pending.current = null;
        place(cursor.current.x, cursor.current.y);
      });
    };

    element.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      element.removeEventListener("mousemove", onMove);
      if (pending.current !== null) cancelAnimationFrame(pending.current);
    };
  }, [place]);

  const toggleFullscreen = useCallback(() => {
    // Both calls reject when the gesture is untrusted or the API is blocked; the
    // map is perfectly usable inline, so a failure is not worth surfacing.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void shell.current?.requestFullscreen().catch(() => {});
  }, []);

  // The canvas is sized by flex layout, never by JS. That means the server
  // renders the final geometry and the map does not jump on load; JS only ever
  // reads the result back to lay the tiles out.
  const canvasHeight = size.h;

  /*
   * The preview tile answers "what would this buy" for the form above the
   * wall. Fullscreen hides that form, so the dashed square becomes an
   * unexplained hole in the map with a price on it and nothing to connect it to.
   */
  /*
   * A top-up has no preview tile: there is no new square to draw, so the one
   * the buyer already holds simply grows. Drawing a phantom as well showed a
   * holder at 2% both their real square and a second one at 10% — twelve
   * percent of themselves, and a wall that redistributed twice over.
   */
  const toppingUp =
    previewHandle === null
      ? null
      : (state.standings.find((s) => s.holder.handle === previewHandle) ?? null);
  const previewing = mapPreviewActive({
    wantPreview,
    amountCents: preview,
    fullscreen: isFullscreen,
  });

  const previewShare =
    previewing && toppingUp === null && preview !== null
      ? shareAfterSpend(
          state.standings.map((s) => ({ id: s.holder.id, liveCents: s.liveCents })),
          preview,
        )
      : 0;

  /*
   * Grown in place, with every share recomputed — not just the buyer's cents
   * bumped. Layout weights read `share`, so raising `liveCents` alone changed
   * nothing on screen; and the point of the preview is that *everyone else*
   * shrinks too, which only falls out of running the real share model.
   */
  const shown = useMemo(() => {
    if (!previewing || !toppingUp) return state.standings;
    const bumped = state.standings.map((s) => ({
      id: s.holder.id,
      liveCents: s.liveCents + (s.holder.id === toppingUp.holder.id ? (preview ?? 0) : 0),
    }));
    const after = new Map(computeShares(bumped).map((row) => [row.id, row.share]));
    return state.standings.map((s, i) => ({
      ...s,
      liveCents: bumped[i]!.liveCents,
      share: after.get(s.holder.id) ?? s.share,
    }));
  }, [state.standings, previewing, toppingUp, preview]);

  const { tiles, byId, previewRect } = useMemo(() => {
    const byId = new Map(shown.map((s) => [s.holder.id, s]));
    const packed = placeWall(
      shown.map((s) => ({ id: s.holder.id, share: s.share })),
      { w: size.w, h: canvasHeight },
      previewShare,
    );
    return { tiles: packed.tiles, byId, previewRect: packed.previewRect };
  }, [shown, size.w, canvasHeight, previewShare]);

  const onEnter = useCallback((standing: HolderStanding) => setHover({ standing }), []);

  const onLeave = useCallback(() => setHover(null), []);

  const onFocusTile = useCallback(
    (standing: HolderStanding, element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      place(box.left, box.bottom);
      setHover({ standing });
    },
    [place],
  );

  const previewBox = previewRect ? tileBox(previewRect, size) : null;
  /*
   * What the dashed square can say at the size it got. The share is the whole
   * point of it, so `previewContent` shrinks that line rather than dropping it —
   * the flat pixel gates this replaced drew an empty box at the default amount.
   */
  const empty = state.counters.squaresLive === 0;
  const previewShareLabel = formatShare(previewShare);
  const previewCaption =
    toppingUp === null && previewHandle ? previewHandle : empty ? "Yours" : "your square";
  const captionIsHandle = toppingUp === null && previewHandle !== null;
  const previewPriceLabel = empty ? "until the next square" : `for ${formatMoney(preview ?? 0)}`;
  const previewText = previewRect
    ? previewContent(
        previewRect.w,
        previewRect.h,
        previewShareLabel,
        previewPriceLabel,
        previewCaption,
      )
    : null;

  return (
    <div
      ref={shell}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        isFullscreen && "h-screen rounded-none p-3",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-1.5 md:px-4">
        <MapSearch />
        <div className="ml-auto flex shrink-0 items-center gap-x-2">
          {isFullscreen ? null : <PreviewSwitch />}
          {isFullscreen ? <RefreshButton /> : null}
          <DownloadWallButton />
          <ShareWallButton compact />
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </div>

      <div
        ref={frame}
        className={cn("map-canvas relative w-full bg-map-grout", "min-h-50 flex-1 sm:min-h-70")}
      >
        <SearchedTileLayer
          tiles={tiles}
          byId={byId}
          canvas={size}
          flash={flash}
          now={state.generatedAt}
          onEnter={onEnter}
          onLeave={onLeave}
          onFocusTile={onFocusTile}
        />

        {previewBox && previewRect ? (
          <div
            aria-hidden
            className="tile-preview pointer-events-none flex flex-col justify-center gap-0.5 px-2 text-center"
            style={{
              transform: `translate(${previewBox.x}px, ${previewBox.y}px)`,
              width: previewBox.w,
              height: previewBox.h,
            }}
          >
            {previewText?.sharePx ? (
              <>
                {previewText.caption ? (
                  <p
                    className={cn(
                      "text-[10px] font-bold text-primary/70",
                      captionIsHandle ? "truncate" : "tracking-[0.14em] uppercase",
                    )}
                  >
                    {previewCaption}
                  </p>
                ) : null}
                <p
                  className="num leading-none font-bold text-primary"
                  style={{ fontSize: previewText.sharePx }}
                >
                  {previewShareLabel}
                </p>
                {previewText.price ? (
                  <p className="num text-[12px] leading-tight font-medium text-primary/90">
                    {previewPriceLabel}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <MapTooltip target={hover} now={state.generatedAt} elementRef={tooltip} />
    </div>
  );
}

/** Tiles subscribe to Find here so typing does not redraw the toolbar. */
function SearchedTileLayer(props: Omit<TileLayerProps, "needle">) {
  const query = useAtomValue(mapSearchAtom);
  return <TileLayer {...props} needle={query.trim().toLowerCase()} />;
}
