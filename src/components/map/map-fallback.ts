/**
 * Canvases painted before the real box has been measured.
 *
 * The server does not know the viewport, and waiting for a resize observer
 * left the grout empty until JavaScript ran. Each entry is a canvas the CSS
 * box can be close to. `@container` shows the one whose aspect matches, scaled
 * with `zoom` to the real width. The measured layout replaces them once the
 * box is known.
 *
 * `maxAspect` is the top of the bucket (width / height), exclusive of the next
 * one. The last bucket has no top. Keep `mapFallbackCss` as the only place
 * those cuts are written down.
 */
export const MAP_CANVAS_FALLBACKS = [
  { id: "a", w: 800, h: 600, maxAspect: 1.48 },
  { id: "b", w: 922, h: 576, maxAspect: 1.72 },
  { id: "c", w: 1071, h: 576, maxAspect: 2.02 },
  { id: "d", w: 1325, h: 576, maxAspect: 2.6 },
  { id: "e", w: 1786, h: 576, maxAspect: null },
] as const;

export type MapCanvasFallback = (typeof MAP_CANVAS_FALLBACKS)[number];

/** Container queries that reveal one fallback. The canvas is `container-name: map`. */
export function mapFallbackCss(): string {
  return MAP_CANVAS_FALLBACKS.map((fallback, index) => {
    const prev = index === 0 ? 0 : MAP_CANVAS_FALLBACKS[index - 1]!.maxAspect;
    const query =
      index === 0
        ? `@container map (aspect-ratio <= ${fallback.maxAspect})`
        : fallback.maxAspect === null
          ? `@container map (aspect-ratio > ${prev})`
          : `@container map (aspect-ratio > ${prev}) and (aspect-ratio <= ${fallback.maxAspect})`;
    return `${query}{.map-fit-${fallback.id}{display:block}}`;
  }).join("");
}
