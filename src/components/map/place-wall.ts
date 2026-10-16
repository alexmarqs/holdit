import {
  AREA_EXPONENT,
  computeShares,
  MIN_TILE_AREA,
  minShareFor,
  type Placed,
  squarify,
} from "@holdit/core";

export const PREVIEW_ID = "__preview__";

/**
 * Place squares on a canvas the way the live map does.
 *
 * Existing squares are scaled down by exactly `previewShare` so the ghost
 * appears and everyone else shrinks in the same instant. The download passes 0:
 * packing with a ghost then hiding it leaves a grout hole.
 *
 * The min-tile floor is applied to *weights*, not shares. `AREA_EXPONENT`
 * means area is not proportional to share, so flooring share would not floor
 * area. `maxShare: 1` skips the 10% cap, already applied upstream.
 */
export function placeWall(
  standings: readonly { id: string; share: number }[],
  canvas: { w: number; h: number },
  previewShare = 0,
): {
  tiles: Placed<{ id: string; weight: number }>[];
  previewRect: Placed<{ id: string; weight: number }> | null;
} {
  if (canvas.w === 0 || canvas.h === 0) return { tiles: [], previewRect: null };

  const scale = 1 - previewShare;
  const weights = standings
    .filter((s) => s.share > 0)
    .map((s) => ({ id: s.id, liveCents: (s.share * scale) ** AREA_EXPONENT }));

  if (previewShare > 0) {
    weights.push({ id: PREVIEW_ID, liveCents: previewShare ** AREA_EXPONENT });
  }

  const items = computeShares(weights, {
    minShare: minShareFor(MIN_TILE_AREA, canvas.w * canvas.h),
    maxShare: 1,
  })
    .map((s) => ({ id: s.id, weight: s.share }))
    .sort((a, b) => b.weight - a.weight);

  const placed = squarify(items, { x: 0, y: 0, w: canvas.w, h: canvas.h });
  const previewTile = placed.find((t) => t.id === PREVIEW_ID) ?? null;

  return {
    tiles: placed.filter((t) => t.id !== PREVIEW_ID),
    previewRect: previewTile,
  };
}
