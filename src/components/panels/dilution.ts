export const HELD_KEY = "holdit.held";

/** A tenth of a percent — smaller than that is decay noise, not a story. */
const DROP_FLOOR = 0.001;

export type HandleStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

/** How much a square shrank, or null if nothing happened worth saying. */
export function dilutionDrop(before: number, after: number): number | null {
  const drop = before - after;
  if (drop < DROP_FLOOR) return null;
  return drop;
}

export function rememberHandle(storage: HandleStorage, handle: string): void {
  storage?.setItem(HELD_KEY, handle);
}

export function recallHandle(storage: HandleStorage): string | null {
  const value = storage?.getItem(HELD_KEY)?.trim();
  return value && value.length > 0 ? value : null;
}

export function forgetHandle(storage: HandleStorage): void {
  storage?.removeItem(HELD_KEY);
}
