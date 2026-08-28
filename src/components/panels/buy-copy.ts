import { formatMoney, formatShare } from "@/lib/utils/format";

/**
 * Cap first, then the product: this spend keeps that share until other
 * people add the named amount. Not a timer — other people's money.
 */
export function holdCapCopy(amountCents: number, share: number, othersCanAddCents: number) {
  return `${formatShare(share)} is the cap. ${formatMoney(amountCents)} keeps ${formatShare(share)} until others add ${formatMoney(othersCanAddCents)}`;
}
