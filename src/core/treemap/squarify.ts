import type { Rect } from "../types";

export interface WeightedItem {
  id: string;
  /** Any positive number. Ratios are all that matter. */
  weight: number;
}

export type Placed<T extends WeightedItem> = T & Rect;

function worstRatio(row: readonly number[], side: number, scale: number): number {
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const w of row) {
    const a = w * scale;
    sum += a;
    if (a > max) max = a;
    if (a < min) min = a;
  }
  if (sum <= 0 || min <= 0) return Number.POSITIVE_INFINITY;
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

/**
 * Squarified treemap (Bruls, Huizing & van Wijk). Items must be sorted by
 * descending weight; zero and negative weights are dropped.
 */
export function squarify<T extends WeightedItem>(items: readonly T[], rect: Rect): Placed<T>[] {
  const out: Placed<T>[] = [];
  layout(
    items.filter((i) => i.weight > 0),
    rect,
    out,
  );
  return out;
}

function layout<T extends WeightedItem>(items: readonly T[], rect: Rect, out: Placed<T>[]): void {
  if (items.length === 0 || rect.w <= 0 || rect.h <= 0) return;

  const first = items[0];
  if (!first) return;
  if (items.length === 1) {
    out.push({ ...first, ...rect });
    return;
  }

  const total = items.reduce((sum, i) => sum + i.weight, 0);
  const scale = (rect.w * rect.h) / total;
  const side = Math.min(rect.w, rect.h);

  let row: T[] = [first];
  let best = worstRatio([first.weight], side, scale);
  let cut = 1;

  while (cut < items.length) {
    const next = items[cut];
    if (!next) break;
    const candidate = [...row, next];
    const ratio = worstRatio(
      candidate.map((i) => i.weight),
      side,
      scale,
    );
    if (ratio > best) break;
    row = candidate;
    best = ratio;
    cut++;
  }

  const rowWeight = row.reduce((sum, i) => sum + i.weight, 0);
  const thickness = (rowWeight * scale) / side;
  let offset = 0;

  if (rect.w >= rect.h) {
    for (const item of row) {
      const h = (item.weight * scale) / thickness;
      out.push({ ...item, x: rect.x, y: rect.y + offset, w: thickness, h });
      offset += h;
    }
    layout(
      items.slice(cut),
      { x: rect.x + thickness, y: rect.y, w: rect.w - thickness, h: rect.h },
      out,
    );
  } else {
    for (const item of row) {
      const w = (item.weight * scale) / thickness;
      out.push({ ...item, x: rect.x + offset, y: rect.y, w, h: thickness });
      offset += w;
    }
    layout(
      items.slice(cut),
      { x: rect.x, y: rect.y + thickness, w: rect.w, h: rect.h - thickness },
      out,
    );
  }
}
