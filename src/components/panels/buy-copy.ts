import { formatMoney, formatShare } from "@/lib/utils/format";

/**
 * Cap first, then what the money past it actually buys.
 *
 * This used to name the wall size at which the hold would end, drawn from raw
 * spend over the ceiling. That figure measures the wrong thing: the water-fill
 * lifts a capped square back over the ceiling out of the overflow of the
 * squares above it, so a hold can survive far past the named amount — and what
 * ends it is other squares individually outgrowing yours, in a number that
 * depends on the whole wall rather than on the ceiling.
 *
 * No short sentence names that threshold truthfully, so this one names no
 * threshold. What it names instead is the advantage the terms page always
 * claimed and which does hold: extra spend defends the cap. Across 123 random
 * walls where both a spend and ten times it reach the cap, the larger square
 * survived strictly more rival money every time, with no ties — the property
 * test is in `hold-claim.test.ts`.
 *
 * "Longer" and not a threshold: it is the monotonic claim, which is the only
 * one that cannot be made false. One square adding money often cannot dislodge
 * you at any price, because its own overflow water-fills back onto you, so the
 * line deliberately says nothing about who pushes you off or when.
 *
 * "For now" because the ceiling is `ceilingFor(n)` and tightens as squares
 * arrive. A bare "is the cap" promises a number the next buyer changes without
 * spending anything against this square.
 *
 * The hold and the square are named separately on purpose. "Holds it" is the
 * cap; a bigger "it" would be the square, and the two are the whole point of
 * the sentence, so leaning on one pronoun for both loses it.
 */
export function holdCapCopy(amountCents: number, share: number) {
  return (
    `${formatShare(share)} is the cap for now. ${formatMoney(amountCents)} holds it. ` +
    `More buys a longer hold, not a bigger square`
  );
}

/**
 * Whether a move from `before` to `after` is one the buyer can actually see.
 *
 * The rendered strings decide it, not a threshold. `formatShare` gives a share
 * as many digits as it needs, so the question "would this look like anything?"
 * has exactly one honest answer, and it is the one on screen.
 */
function visiblyChanges(before: number, after: number): boolean {
  return formatShare(before) !== formatShare(after);
}

/**
 * The label on the buy button.
 *
 * A new square offers the share it takes. A top-up offers the difference it
 * makes — except when that difference is too small to render, which is a real
 * purchase on a busy wall and used to read "Add +0.00%": the dollars moved and
 * the button did not. Then it names where the square lands instead, which is
 * true at any size.
 */
export function holdButtonLabel(
  share: number,
  existingShare: number | null,
  atDisplayCap: boolean,
): string {
  if (existingShare === null) return `Hold ${formatShare(share)}`;
  if (atDisplayCap) return `Add ${formatShare(share)}`;
  if (!visiblyChanges(existingShare, share)) return `Add to ${formatShare(share)}`;
  return `Add +${formatShare(Math.max(0, share - existingShare))}`;
}

/**
 * The line under the field when topping up a square that is not at the cap.
 *
 * An arrow between two identical numbers says nothing, so when the share does
 * not visibly move this says what the money did buy: the same size, held
 * against more of everyone else's spend.
 */
export function topUpCopy(handle: string, before: number, after: number): string {
  if (!visiblyChanges(before, after)) {
    return `Topping up ${handle}: holds ${formatShare(after)}. More of other people's money to last through`;
  }
  return `Topping up ${handle}: ${formatShare(before)} → ${formatShare(after)}`;
}
