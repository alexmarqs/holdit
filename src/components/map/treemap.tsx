"use client";

import { computeShares, type HolderStanding, previewContent, shareAfterSpend } from "@holdit/core";
import { useAtomValue } from "jotai";
import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { MAP_CANVAS_FALLBACKS, mapFallbackCss } from "./map-fallback";
import { MapSearch } from "./map-search";
import { type HoverTarget, MapTooltip } from "./map-tooltip";
import { placeWall } from "./place-wall";
import { mapPreviewActive } from "./preview";
import { PreviewSwitch } from "./preview-switch";
import { ShareWallButton } from "./share-wall";
import { TileLayer, type TileLayerProps, tileBox } from "./tile-layer";

const TOOLTIP_W = 190;
const TOOLTIP_H = 148;

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
  const [isFullscreen, setFullscreen] = useState(false);

  const shell = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  const resizeEnd = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextSize = useRef({ w: 0, h: 0 });
  const measured = useRef(false);
  const cursor = useRef({ x: 0, y: 0 });
  const [isResizing, setResizing] = useState(false);

  /*
   * Read the box before paint. A resize observer started from useEffect only
   * fires after the empty canvas has already been shown.
   */
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;

    const commit = (w: number, h: number, resize: boolean) => {
      if (w <= 0 || h <= 0) return;
      nextSize.current = { w, h };
      setSize((current) => (current.w === w && current.h === h ? current : { w, h }));
      if (!resize || !measured.current) {
        measured.current = true;
        return;
      }
      setResizing(true);
      if (resizeEnd.current !== null) clearTimeout(resizeEnd.current);
      resizeEnd.current = setTimeout(() => {
        resizeEnd.current = null;
        setResizing(false);
      }, 120);
    };

    const rect = element.getBoundingClientRect();
    commit(rect.width, rect.height, false);

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (
        Math.abs(width - nextSize.current.w) < 0.5 &&
        Math.abs(height - nextSize.current.h) < 0.5
      ) {
        return;
      }
      commit(width, height, true);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (resizeEnd.current !== null) clearTimeout(resizeEnd.current);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shell.current);
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
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void shell.current?.requestFullscreen().catch(() => {});
  }, []);

  // The canvas is sized by CSS, never by JS. Form growth does not change that
  // box — JS only reads it back to lay the tiles inside. Until that read lands,
  // a fallback close to the CSS aspect is already in the HTML.
  const hasSize = size.w > 0 && size.h > 0;

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
  const empty = state.counters.squaresLive === 0;
  const toppingUp =
    previewHandle === null
      ? null
      : (state.standings.find((s) => s.holder.handle === previewHandle) ?? null);
  const previewing = mapPreviewActive({
    wantPreview,
    amountCents: preview,
    fullscreen: isFullscreen,
    empty,
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

  const paint = {
    shown,
    previewShare,
    preview,
    previewHandle,
    empty,
    toppingUp,
    flash,
    now: state.generatedAt,
    omitShare: previewing && toppingUp === null,
    onEnter,
    onLeave,
    onFocusTile,
  };

  return (
    <div
      ref={shell}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        isFullscreen && "h-screen rounded-none p-3",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2.5 py-1.5 bg-background/90">
        <MapSearch />
        <div className="ml-auto flex shrink-0 items-center gap-x-2">
          {empty || isFullscreen ? null : <PreviewSwitch />}
          {isFullscreen ? <RefreshButton /> : null}
          <DownloadWallButton />
          <ShareWallButton compact />
          <Button
            variant="outline"
            size="icon"
            className="max-md:hidden"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </div>

      <div
        ref={frame}
        data-resizing={isResizing || undefined}
        className={cn(
          "map-canvas relative w-full bg-map-grout",
          isFullscreen
            ? "min-h-0 flex-1"
            : "aspect-[4/3] min-h-50 shrink-0 sm:min-h-70 max-h-[min(70svh,36rem)]",
        )}
      >
        {hasSize ? (
          <CanvasPaint canvas={size} {...paint} />
        ) : (
          <>
            <style>{mapFallbackCss()}</style>
            {MAP_CANVAS_FALLBACKS.map((fallback) => (
              <div
                key={fallback.id}
                className={`map-fit map-fit-${fallback.id}`}
                style={{
                  width: fallback.w,
                  height: fallback.h,
                  zoom: `calc(100cqw / ${fallback.w}px)`,
                }}
              >
                <CanvasPaint canvas={fallback} {...paint} />
              </div>
            ))}
          </>
        )}
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

function CanvasPaint({
  canvas,
  shown,
  previewShare,
  preview,
  previewHandle,
  empty,
  toppingUp,
  flash,
  now,
  omitShare,
  onEnter,
  onLeave,
  onFocusTile,
}: {
  canvas: { w: number; h: number };
  shown: HolderStanding[];
  previewShare: number;
  preview: number | null;
  previewHandle: string | null;
  empty: boolean;
  toppingUp: HolderStanding | null;
  flash: string | null;
  now: number;
  omitShare: boolean;
  onEnter: (standing: HolderStanding) => void;
  onLeave: () => void;
  onFocusTile: (standing: HolderStanding, element: HTMLElement) => void;
}) {
  const { tiles, byId, previewRect } = useMemo(() => {
    const byId = new Map(shown.map((s) => [s.holder.id, s]));
    const packed = placeWall(
      shown.map((s) => ({ id: s.holder.id, share: s.share })),
      canvas,
      previewShare,
    );
    return { tiles: packed.tiles, byId, previewRect: packed.previewRect };
  }, [shown, canvas, previewShare]);

  const previewBox = previewRect ? tileBox(previewRect, canvas) : null;
  /*
   * What the dashed square can say at the size it got. The share is the whole
   * point of it, so `previewContent` shrinks that line rather than dropping it —
   * the flat pixel gates this replaced drew an empty box at the default amount.
   */
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
    <>
      <SearchedTileLayer
        tiles={tiles}
        byId={byId}
        canvas={canvas}
        flash={flash}
        now={now}
        omitShare={omitShare}
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
    </>
  );
}
