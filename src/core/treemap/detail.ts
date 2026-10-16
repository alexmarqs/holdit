/**
 * What a square shows, decided element by element from the room it has.
 *
 * Two earlier designs failed here, and both failures are worth recording.
 *
 * The first was a *ladder*: four rungs, each gated on area AND width AND
 * height, so a tile earned "name" or "tagline" wholesale. Because a treemap
 * decides shape as well as size, the biggest square was often the tall narrow
 * one — so a 57% square could lose a rung that a 32% square kept, which reads
 * as a bug to whoever paid for the bigger square.
 *
 * The second was a *coherence ceiling* layered on top: walk squares from the
 * largest share down and never let the level rise again, making detail
 * monotonic in share by construction. That turned one bad tile into a silent
 * region — `tailwindcss.com` needed 105px for its own name, had 100px, dropped
 * to logo-only, and took the six smaller squares below it down with it.
 *
 * So there is no ladder and no ceiling. Each element asks only whether it
 * fits, and the type shrinks before it truncates, and it truncates before it
 * disappears. A partial name still identifies a square; an empty teal
 * rectangle does not.
 */

/** Below this, a rotated handle will not fit beside the padding. */
const SPINE_MIN_W = 22;
/** Logo + a few letters of the handle. Shorter columns stay mark-only. */
const SPINE_MIN_H = 80;
/** Twice as tall as wide — the empty-teal strip, not a merely-squat rectangle. */
const SPINE_MIN_ASPECT = 2;
const SPINE_MAX_W = 78;
const SPINE_MIN_AREA = 1_800;

/**
 * A column too narrow for a row of type, tall enough to write the handle down
 * it. Layout-only: buying more does not promise this shape.
 */
export function isSpineTile(w: number, h: number): boolean {
  return (
    w >= SPINE_MIN_W &&
    w < SPINE_MAX_W &&
    h >= SPINE_MIN_H &&
    h >= SPINE_MIN_ASPECT * w &&
    w * h >= SPINE_MIN_AREA
  );
}

/**
 * Advance width of the bold tile face as a fraction of its size, plus the
 * tile's horizontal padding. Deliberately generous — over-estimating costs a
 * font step, under-estimating clips a name.
 */
const CHAR_WIDTH_RATIO = 0.62;
const TILE_PADDING_X = 16;

/*
 * The vertical budget, mirroring the horizontal one. Width was gated and height
 * was not, so a tile with room for the letters but not for the line box drew a
 * name half off its own bottom edge — unreadable in a way an ellipsis is not.
 * These match `.tile` in globals.css and the `mt-1.5` on the name.
 */
const TILE_PADDING_Y = 12;
const NAME_GAP = 6;
const LINE_HEIGHT = 1.5;
/** Below this the mark stops reading as a mark, so the name goes instead. */
const LOGO_MIN_PX = 12;

function lineBox(fontPx: number): number {
  return Math.ceil(fontPx * LINE_HEIGHT);
}

/** Type sizes the tile face steps down through before it gives up and clips. */
const FONT_STEPS = [20, 16, 13, 11] as const;

/** The two rows under the name, matching the tile styles. */
const STATS_FONT_PX = 12;
const STATS_GAP = 2;
const TAGLINE_FONT_PX = 12;
const TAGLINE_GAP = 8;

/** Every gate is a plain "does this element physically fit" question. */
const LOGO_MIN_AREA = 460;
/* 44px holds a three-letter stem in full and a longer one truncated, which is
 * the trade the wall wants: a partial name identifies a square, a bare
 * rectangle does not. Below this only two characters survive, so it stops. */
const NAME_MIN_W = 44;
const NAME_MIN_H = 30;
const STATS_MIN_W = 96;
const STATS_MIN_H = 62;
/** About fifteen characters per line; narrower fragments read as visual noise. */
const TAGLINE_MIN_W = 128;

export interface TileLabels {
  /** The domain without its suffix — what a cramped tile falls back to. */
  short: string;
  /** The whole handle. */
  full: string;
  /** The stat line this tile would print, so its wrapped height is known. */
  stats?: string;
  /** The tagline this tile would print, for the same reason. */
  tagline?: string | null;
}

export interface TileContent {
  /** Rendered at every size; the tile crops it when there is no room. */
  logoPx: number;
  /** Narrow and tall: the handle runs down the column instead of across. */
  spine: boolean;
  name: string | null;
  nameFontPx: number;
  /** True when the chosen name still overflows and CSS has to clip it. */
  nameClipped: boolean;
  stats: boolean;
  /** The number of description lines that physically fit, from none to three. */
  taglineLines: 0 | 1 | 2 | 3;
}

export function widthForLabel(text: string, fontPx: number): number {
  return Math.ceil(text.length * fontPx * CHAR_WIDTH_RATIO) + TILE_PADDING_X;
}

function logoSize(w: number, h: number, tagline: boolean, stats: boolean): number {
  if (tagline) return 32;
  if (stats) return 24;
  if (w * h >= LOGO_MIN_AREA) return 16;
  // Under the logo rung the mark is all there is, so it fills the tile and the
  // overflow is cropped. Never below 13px or it stops reading as a mark.
  return Math.max(13, Math.min(w, h));
}

export function tileContent(w: number, h: number, labels: TileLabels): TileContent {
  if (isSpineTile(w, h)) {
    return {
      logoPx: Math.min(14, Math.max(12, w - 10)),
      spine: true,
      name: labels.full,
      nameFontPx: 11,
      nameClipped: false,
      stats: false,
      taglineLines: 0,
    };
  }

  const showName = w >= NAME_MIN_W && h >= NAME_MIN_H;
  const stats = showName && w >= STATS_MIN_W && h >= STATS_MIN_H && Boolean(labels.stats);
  const tagline = showName && w >= TAGLINE_MIN_W && Boolean(labels.tagline);
  // Typography belongs to the tile's geometry, not its metadata. A holder
  // without a stored description must not receive a smaller name or logo than
  // an equally sized neighbor that has one.
  const roomyTile = showName && w >= 150 && h >= 146;
  const cap = roomyTile ? 20 : stats ? 16 : 13;

  let logoPx = logoSize(w, h, roomyTile, stats);
  let name: string | null = null;
  let nameFontPx = cap;
  let nameClipped = false;

  if (showName) {
    // Largest type first, and at each size the whole handle before the short
    // form: "tailwindcss" at 16px reads better than "tailwindcss.com" at 11px.
    outer: for (const font of FONT_STEPS) {
      if (font > cap) continue;

      // The mark gives up height before the name does — a slightly smaller logo
      // beside a readable name beats a full-size logo beside a clipped one.
      const room = h - TILE_PADDING_Y - NAME_GAP - lineBox(font);
      if (room < LOGO_MIN_PX) continue;
      const fitted = Math.min(logoPx, room);

      for (const text of [labels.full, labels.short]) {
        if (widthForLabel(text, font) <= w) {
          name = text;
          nameFontPx = font;
          logoPx = fitted;
          break outer;
        }
      }

      // Nothing fits across at this size, but it fits down. The smallest step
      // clips horizontally on purpose: a truncated name still identifies a
      // square, where a vertically sliced one identifies nothing.
      if (font === FONT_STEPS.at(-1)) {
        name = labels.short;
        nameFontPx = font;
        logoPx = fitted;
        nameClipped = true;
      }
    }
  }

  /*
   * Re-check the rows under the name against the height they will actually
   * take. The gates above only measured logo + name, so a tile could pass them
   * and then have the stat line — two lines of it, once wrapped — pushed
   * through its own bottom edge, slicing the name in half. Both rows can only
   * turn off here, never on, so nothing that already fits is lost.
   */
  const linesFor = (text: string | null | undefined, fontPx: number) =>
    text ? Math.max(1, Math.ceil(widthForLabel(text, fontPx) / Math.max(1, w))) : 1;

  let usedH = name === null ? 0 : TILE_PADDING_Y + logoPx + NAME_GAP + lineBox(nameFontPx);

  let showStats = stats && name !== null;
  if (showStats) {
    const need = usedH + STATS_GAP + linesFor(labels.stats, STATS_FONT_PX) * lineBox(STATS_FONT_PX);
    if (need > h) showStats = false;
    else usedH = need;
  }

  const taglineRoom = tagline && name !== null ? h - usedH - TAGLINE_GAP : 0;
  const taglineLines = Math.max(
    0,
    Math.min(3, Math.floor(taglineRoom / lineBox(TAGLINE_FONT_PX))),
  ) as 0 | 1 | 2 | 3;

  return {
    logoPx,
    spine: false,
    name,
    nameFontPx,
    nameClipped,
    stats: showStats,
    taglineLines,
  };
}

/** Type sizes the preview's percentage steps down through. */
const PREVIEW_FONT_STEPS = [22, 18, 15, 12, 10] as const;
/** The caption and the price, matching the preview styles in `Treemap`. */
const PREVIEW_CAPTION_PX = 10;
const PREVIEW_PRICE_PX = 12;

export interface PreviewContent {
  /** Font size for the share, or null when not even the smallest step fits. */
  sharePx: number | null;
  caption: boolean;
  price: boolean;
}

/**
 * What the preview square shows, by the same rule as a real one: the type
 * shrinks before it disappears.
 *
 * It used to be four pixel constants in the component, the first of which
 * demanded 74px of width before anything at all was drawn. The default $10
 * preview is 0.39% of a wall this size — about 70px wide — so the one tile whose
 * entire job is to state a number rendered as an empty dashed box, on first
 * paint, to every visitor who had not touched the panel. `0.39%` needs 63px at
 * 15px type, and there was room for the price underneath as well.
 *
 * Order matters: the share is the point, so it takes the room first and the
 * caption — the only purely decorative line — is last to be granted any.
 */
export function previewContent(
  w: number,
  h: number,
  share: string,
  price: string,
  caption = "your square",
): PreviewContent {
  const sharePx =
    PREVIEW_FONT_STEPS.find((px) => widthForLabel(share, px) <= w && lineBox(px) <= h) ?? null;
  if (sharePx === null) return { sharePx: null, caption: false, price: false };

  let usedH = lineBox(sharePx);
  const showPrice =
    widthForLabel(price, PREVIEW_PRICE_PX) <= w && usedH + lineBox(PREVIEW_PRICE_PX) <= h;
  if (showPrice) usedH += lineBox(PREVIEW_PRICE_PX);

  const showCaption =
    widthForLabel(caption, PREVIEW_CAPTION_PX) <= w && usedH + lineBox(PREVIEW_CAPTION_PX) <= h;

  return { sharePx, caption: showCaption, price: showPrice };
}
