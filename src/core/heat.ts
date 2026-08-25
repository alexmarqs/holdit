import { HEAT_WINDOW_DAYS, MS_PER_DAY } from "./config";

/**
 * Warmth channel: how recently a square was topped up.
 *
 * Returned as a plain 0–1 level rather than a colour. The renderer hands it to
 * CSS, which scales it by a per-theme ceiling — a light theme can push a tile
 * far towards lime and keep dark text legible, a dark theme cannot. Keeping the
 * ceiling in CSS is what lets one number serve both themes.
 */

/** 0 = cold, 1 = bought moments ago. */
export function heatLevel(lastPurchaseAt: number | null, now: number): number {
  if (lastPurchaseAt === null) return 0;
  const days = (now - lastPurchaseAt) / MS_PER_DAY;
  const linear = 1 - days / HEAT_WINDOW_DAYS;
  // The exponent matters more than the window. Linear leaves most of a real map
  // in the bright half, and a map where everything is hot says nothing.
  return Math.min(1, Math.max(0, linear)) ** 2.6;
}
