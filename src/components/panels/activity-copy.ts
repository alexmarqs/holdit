import type { ActivityEvent } from "@holdit/core";
import { formatMoney, formatShare } from "@/lib/utils/format";

type ActivityLine = Pick<ActivityEvent, "kind" | "shareBefore" | "shareAfter" | "amountCents">;

/**
 * One line under a handle in the feed. A new square is a grab; a top-up is
 * the dilution other holders actually feel.
 */
export function activityLine(event: ActivityLine): string {
  if (event.shareAfter <= 0) return formatMoney(event.amountCents);
  if (event.kind === "bought_in" || event.shareBefore === null) {
    return `took ${formatShare(event.shareAfter)} · ${formatMoney(event.amountCents)}`;
  }
  return `${formatShare(event.shareBefore)} → ${formatShare(event.shareAfter)} · everyone else shrank`;
}
