"use client";

import {
  AREA_EXPONENT,
  computeShares,
  type HolderStanding,
  MIN_TILE_AREA,
  minShareFor,
  previewContent,
  shareAfterSpend,
  squarify,
} from "@holdit/core";
import { formatInt, formatMoney, formatShare } from "@holdit/utils/format";
import { useAtomValue } from "jotai";
import { Maximize2, Minimize2, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flashAtom, previewAtom, previewHandleAtom, wallAtom } from "@/components/map-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { onSquareFocus } from "./focus-square";
import { type HoverTarget, MapTooltip } from "./map-tooltip";
import { ShareWallButton } from "./share-wall";
import { TileLayer, tileBox } from "./tile-layer";

const TOOLTIP_W = 190;
const TOOLTIP_H = 122;
const PREVIEW_ID = "__preview__";

/**
 * The map. Every square on one canvas, area proportional to its share.
 *
 * Tiles are keyed by square and never rebuilt — only transform, width and
 * height change — so a purchase reads as the whole map redistributing rather
 * than as a repaint. Hover is deliberately kept out of React: the tooltip is
 * positioned imperatively, so moving the pointer costs no renders and no layout.
 */
export function Treemap() {
  const state = useAtomValue(wallAtom);
  const flash = useAtomValue(flashAtom);
  const preview = useAtomValue(previewAtom);
  const previewHandle = useAtomValue(previewHandleAtom);
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const shell = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  const cursor = useRef({ x: 0, y: 0 });

  useEffect(
    () =>
      onSquareFocus(window, (handle) => {
        setQuery(handle);
        document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }),
    [],
  );

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
   * The preview tile answers "what would this buy" for the panel above the
   * wall. Fullscreen hides that panel, so the dashed square becomes an
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
  const previewing = preview !== null && !isFullscreen;

  const previewShare =
    previewing && toppingUp === null
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
      liveCents: s.liveCents + (s.holder.id === toppingUp.holder.id ? preview : 0),
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
    if (size.w === 0 || canvasHeight === 0) return { tiles: [], byId, previewRect: null };

    // Existing squares are scaled down by exactly the share the preview would
    // take. This is the product in one gesture: your square appears and every
    // other square gets smaller in the same instant.
    const scale = 1 - previewShare;
    const weights = shown
      .filter((s) => s.share > 0)
      // The exponent compresses the range so the tail stays clickable.
      .map((s) => ({ id: s.holder.id, liveCents: (s.share * scale) ** AREA_EXPONENT }));

    if (previewShare > 0) {
      weights.push({ id: PREVIEW_ID, liveCents: previewShare ** AREA_EXPONENT });
    }

    /*
     * Floor the tail here rather than server-side. `MIN_TILE_AREA` is a pixel
     * promise, and pixels only exist once the canvas is measured — which is why
     * nothing ever passed `mapArea` to the query and the smallest square was
     * landing at 198px², well under the 460px² it is owed.
     *
     * The floor applies to the *weights*, not the shares: `AREA_EXPONENT` means
     * a tile's area is not proportional to its share, so flooring share would
     * not floor area. `maxShare: 1` disables the 10% cap, which has already been
     * applied upstream to the shares these weights come from — re-capping the
     * normalised weight would shrink the biggest tiles for no reason.
     */
    const items = computeShares(weights, {
      minShare: minShareFor(MIN_TILE_AREA, size.w * canvasHeight),
      maxShare: 1,
    })
      .map((s) => ({ id: s.id, weight: s.share }))
      .sort((a, b) => b.weight - a.weight);

    const placed = squarify(items, { x: 0, y: 0, w: size.w, h: canvasHeight });
    const previewTile = placed.find((t) => t.id === PREVIEW_ID) ?? null;

    return {
      tiles: placed.filter((t) => t.id !== PREVIEW_ID),
      byId,
      previewRect: previewTile,
    };
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

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? state.standings.filter((s) => s.holder.handle.toLowerCase().includes(needle)).length
    : 0;
  const previewBox = previewRect ? tileBox(previewRect, size) : null;
  /*
   * What the dashed square can say at the size it got. The share is the whole
   * point of it, so `previewContent` shrinks that line rather than dropping it —
   * the flat pixel gates this replaced drew an empty box at the default amount.
   */
  const empty = state.counters.squaresLive === 0;
  const previewShareLabel = formatShare(previewShare);
  const previewCaption = empty ? "Yours" : "your square";
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
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
        isFullscreen && "h-screen rounded-none p-3",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3.5 pb-3 md:px-5 md:pt-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-bold">The wall</h2>
          {state.counters.squaresLive > 0 ? (
            <p className="num text-xs text-muted-foreground">
              {formatInt(state.counters.squaresLive)}{" "}
              {state.counters.squaresLive === 1 ? "square" : "squares"}
            </p>
          ) : null}
        </div>

        {/*
          Search and the two actions are one unit. `w-full` on the field used to
          shove the buttons onto their own row, right-aligned under an empty
          stretch of chrome.
        */}
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
          {state.counters.squaresLive > 0 ? (
            <div className="relative min-w-[10.5rem] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a square"
                spellCheck={false}
                autoComplete="off"
                aria-label="Find a square"
                className={cn("h-9 w-full pl-10 text-sm", needle ? "pr-20" : "pr-3")}
              />
              {needle ? (
                <span className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
                  <span className="num pointer-events-none px-1.5 text-[11px] text-muted-foreground">
                    {matches}
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label="Clear search"
                    title="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : null}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          <ShareWallButton compact />
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </div>

      <div
        ref={frame}
        data-fold={isFullscreen ? undefined : true}
        className={cn(
          "map-canvas relative w-full bg-map-base",
          // Height comes from the flex parent in both modes, so the server
          // renders the final size and the map never jumps on load.
          // A floor low enough that flex can still shrink the wall on a short
          // phone; without it the canvas refuses to yield and pushes the fold.
          "min-h-[200px] flex-1 sm:min-h-[280px]",
        )}
      >
        <TileLayer
          tiles={tiles}
          byId={byId}
          canvas={size}
          needle={needle}
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
                  <p className="text-[10px] font-bold tracking-[0.14em] text-primary/70 uppercase">
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
