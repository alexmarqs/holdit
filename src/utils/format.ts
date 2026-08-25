const INTEGER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const CENTS = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInt(value: number): string {
  return INTEGER.format(Math.round(value));
}

/**
 * Exact dollars. Whole amounts stay "$26"; anything with cents prints them
 * ("$25.70"), because the solver charges those cents and rounding the label
 * would name a different price than checkout.
 */
export function formatMoney(cents: number): string {
  const whole = Math.round(cents);
  if (whole % 100 === 0) return `$${INTEGER.format(whole / 100)}`;
  return `$${CENTS.format(whole / 100)}`;
}

/** The same figure as `formatMoney`, without the "$", for an editable field. */
export function moneyDraft(cents: number): string {
  const whole = Math.round(cents);
  if (whole % 100 === 0) return String(whole / 100);
  return (whole / 100).toFixed(2);
}

/**
 * Digits are a property of the number, not of the call site.
 *
 * The same share used to render "0.4%" in the buy headline and "0.37%" in the
 * tooltip — the panel rounding up and the wall rounding down. A buyer checking
 * they got what they paid for saw the wall contradict the promise, which is the
 * worst possible moment for a rounding disagreement.
 *
 * One decimal is a 10% relative error below 1%, so small shares get two. Pass
 * `digits` only for round *target* values ("2.5% of the wall"), never for a
 * measured share.
 *
 * A measured share never rounds *up*. `toFixed(1)` turned 9.97% into "10.0%",
 * so stepping a dollar off the 10% chip looked like a stuck control: the
 * dollars moved and the share did not. Extra digits appear when one decimal
 * would overstate, or when they are non-zero — otherwise 9.93% and 9.90% both
 * print "9.9%", and the next dollar looks dead too.
 */
export function formatShare(share: number, digits?: number): string {
  const pct = share * 100;
  if (digits !== undefined) return `${pct.toFixed(digits)}%`;
  const minPlaces = Math.abs(pct) < 1 ? 2 : 1;
  const extraPlaces = minPlaces + 1;
  const coarse = pct.toFixed(minPlaces);
  const extra = pct.toFixed(extraPlaces);
  const coarseNum = Number(coarse);
  const extraNum = Number(extra);

  let chosen: string;
  if (coarseNum <= pct + 1e-9) {
    if (minPlaces > 1 || Math.abs(extraNum - coarseNum) < 1e-9) chosen = coarse;
    else if (extraNum <= pct + 1e-9) chosen = extra;
    else chosen = floorPlaces(pct, extraPlaces);
  } else if (extraNum < coarseNum - 1e-9) {
    chosen = extra;
  } else {
    chosen = floorPlaces(pct, extraPlaces);
  }

  if (Math.abs(Number(chosen) - coarseNum) < 1e-9) return `${coarse}%`;
  return `${chosen}%`;
}

function floorPlaces(value: number, places: number): string {
  const factor = 10 ** places;
  return (Math.floor(value * factor + 1e-9) / factor).toFixed(places);
}

const UNITS: [number, string][] = [
  [60_000, "s"],
  [3_600_000, "m"],
  [86_400_000, "h"],
];

/** Compact relative time, as in the activity feed: "just now", "4m", "17h", "3d". */
export function formatAgo(at: number, now: number = Date.now()): string {
  const ms = Math.max(0, now - at);
  if (ms < 45_000) return "just now";
  for (const [limit, unit] of UNITS) {
    if (ms < limit) {
      const divisor = unit === "s" ? 1_000 : unit === "m" ? 60_000 : 3_600_000;
      return `${Math.floor(ms / divisor)}${unit}`;
    }
  }
  const days = Math.floor(ms / 86_400_000);
  return days < 365 ? `${days}d` : `${Math.floor(days / 365)}y`;
}

const PRINT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** UTC instant of a print. Named so the receipt does not look like local time. */
export function formatPrintDate(at: number): string {
  const parts = PRINT_DATE.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("month")} ${part("day")}, ${part("year")}, ${part("hour")}:${part("minute")} UTC`;
}
