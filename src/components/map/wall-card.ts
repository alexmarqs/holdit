import {
  AREA_EXPONENT,
  computeShares,
  heatLevel,
  type MapState,
  MIN_SHOWN_TILE_CLICKS,
  MIN_TILE_AREA,
  minShareFor,
  squarify,
  tileContent,
} from "@holdit/core";
import { faviconUrl, shortHandle } from "@/lib/utils/domain";
import { formatInt, formatMoney, formatPrintDate, formatShare } from "@/lib/utils/format";

export const WALL_CARD_SIZE = { width: 1200, height: 630 };
export const WALL_CARD_HEADER_H = 82;
export const WALL_CARD_MAP = {
  x: 0,
  y: 0,
  w: WALL_CARD_SIZE.width,
  h: WALL_CARD_SIZE.height - WALL_CARD_HEADER_H,
};

/**
 * The card is always the 1200x630 a social card has to be.
 *
 * It used to take a size, because the download sent the on-screen canvas so the
 * saved picture packed the way the wall in front of the viewer did. Nothing
 * asks for another size now, and a caller-controlled one was a guaranteed cache
 * miss on `/api/og` — every distinct value billed a fresh Satori render.
 */
export function wallCardBox() {
  return {
    size: WALL_CARD_SIZE,
    header: WALL_CARD_HEADER_H,
    map: WALL_CARD_MAP,
  };
}

/**
 * The wall's own palettes, lifted from globals.css. Note the heat ceiling
 * differs: the same warmth mixes far less far in the dark.
 */
export type CardTheme = "light" | "dark";

const PALETTES = {
  light: {
    base: [231, 239, 238],
    hot: [53, 224, 208],
    mixMax: 0.82,
    page: "#f4f8f8",
    ink: "#14201f",
    muted: "#5f6f6d",
    tileInk: "#14201f",
  },
  dark: {
    base: [26, 38, 37],
    hot: [53, 224, 208],
    mixMax: 0.44,
    page: "#0c1615",
    ink: "#edf4f3",
    muted: "#93a3a1",
    tileInk: "#edf4f3",
  },
} as const;

export function cardPalette(theme: CardTheme) {
  return PALETTES[theme];
}

/** Matches `.tile` in globals.css, so a name that fits on screen fits here. */
export const CARD_TILE_PAD_X = 8;
export const CARD_TILE_PAD_Y = 6;

export interface WallCardTile {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  handle: string;
  /** What fits on the tile — same rules as the live map. */
  name: string | null;
  nameFontPx: number;
  nameClipped: boolean;
  meta: string;
  color: string;
  spine: boolean;
  showStats: boolean;
  showLogo: boolean;
  logoPx: number;
  /** Google favicon URL when the tile names a square. */
  logoUrl: string | null;
  /** Shown on the largest tiles, exactly as the live wall shows it. */
  tagline: string | null;
}

export interface WallCard {
  stats: string;
  date: string;
  theme: CardTheme;
  tiles: WallCardTile[];
  size: { width: number; height: number };
  header: number;
  map: { x: number; y: number; w: number; h: number };
}

/** Satori has no color-mix, so the warmth channel is mixed here instead. */
export function tileColor(level: number, theme: CardTheme = "light"): string {
  const p = PALETTES[theme];
  const t = level * p.mixMax;
  const mix = p.hot.map((hot, i) => Math.round(p.base[i]! + (hot - p.base[i]!) * t));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

/** The picture of the wall at one instant, as a tweet unfurls it. */
export function wallCardModel(state: MapState, theme: CardTheme = "light"): WallCard {
  const box = wallCardBox();
  const squares =
    state.counters.squaresLive === 1
      ? "1 square"
      : `${formatInt(state.counters.squaresLive)} squares`;

  /*
   * The same two steps the live wall takes, in the same order. The card used to
   * skip the minimum-tile floor, so the tail came out smaller here than on
   * screen and the download did not match the thing it was a picture of.
   */
  const weights = state.standings
    .filter((s) => s.share > 0)
    .map((s) => ({ id: s.holder.id, liveCents: s.share ** AREA_EXPONENT }));
  const placed = squarify(
    computeShares(weights, {
      minShare: minShareFor(MIN_TILE_AREA, box.map.w * box.map.h),
      maxShare: 1,
    })
      .map((row) => ({ id: row.id, weight: row.share }))
      .sort((a, b) => b.weight - a.weight),
    box.map,
  );
  const byId = new Map(state.standings.map((s) => [s.holder.id, s]));

  return {
    stats: `${formatMoney(state.counters.liveCents)} live · ${squares}`,
    date: formatPrintDate(state.generatedAt),
    theme,
    size: box.size,
    header: box.header,
    map: box.map,
    tiles: placed.flatMap((tile) => {
      const standing = byId.get(tile.id);
      if (!standing) return [];
      const w = Math.max(0, tile.w - 4);
      const h = Math.max(0, tile.h - 4);
      const handle = standing.holder.handle;
      const meta =
        standing.clicksAllTime >= MIN_SHOWN_TILE_CLICKS
          ? `${formatShare(standing.share)} · ${formatInt(standing.clicksAllTime)} clicks`
          : formatShare(standing.share);
      const face = tileContent(w, h, {
        short: shortHandle(handle),
        full: handle,
        stats: meta,
        tagline: standing.holder.tagline,
      });
      return [
        {
          id: standing.holder.id,
          x: tile.x + 2,
          y: tile.y + 2,
          w,
          h,
          handle,
          name: face.spine ? handle : face.name,
          nameFontPx: face.nameFontPx,
          nameClipped: face.nameClipped,
          // Word for word what the live tile says, including dropping a zero.
          meta,
          color: tileColor(heatLevel(standing.lastPurchaseAt, state.generatedAt), theme),
          spine: face.spine,
          showStats: face.stats,
          showLogo: true,
          logoPx: face.logoPx,
          /*
           * Every tile, not only the named ones. The live wall draws a mark on
           * all of them — cropped when there is no room — so restricting the
           * card to named tiles replaced real favicons with teal monograms and
           * was the most visible way the download differed from the screen.
           */
          logoUrl: faviconUrl(handle, 128),
          tagline: face.tagline ? standing.holder.tagline : null,
        },
      ];
    }),
  };
}
