import type { ActivityEvent } from "@holdit/core";
import { formatMoney, formatShare } from "@/lib/utils/format";

type ActivityLine = Pick<ActivityEvent, "kind" | "shareBefore" | "shareAfter" | "amountCents">;

/**
 * One line under a handle in the feed. A new square is a grab. A top-up that
 * grows the tile is the dilution other holders feel. A top-up that does not
 * is hold — same size, more of other people's money to last through.
 */
export function activityLine(event: ActivityLine): string {
  if (event.shareAfter <= 0) return formatMoney(event.amountCents);
  if (event.kind === "bought_in" || event.shareBefore === null) {
    return `took ${formatShare(event.shareAfter)} · ${formatMoney(event.amountCents)}`;
  }
  const before = formatShare(event.shareBefore);
  const after = formatShare(event.shareAfter);
  if (before === after) {
    return `held ${after} · ${formatMoney(event.amountCents)}`;
  }
  return `${before} → ${after} · everyone else shrank`;
}
