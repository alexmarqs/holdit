import { HALF_LIFE_DAYS } from "@holdit/core";
import { describe, expect, it } from "vitest";
import { LIVE_SPEND_HREF, liveSpendHint, liveSpendHintShort } from "./live-word";

describe("live spend hint", () => {
  it("explains decay in the same terms as the rules", () => {
    expect(liveSpendHint(HALF_LIFE_DAYS)).toBe(
      `Live spend is what sizes the square. It halves every ${HALF_LIFE_DAYS} days if nobody buys. All-time does not fade. Share only moves when someone else pays.`,
    );
  });

  it("sends more reading to the rules section on fade", () => {
    expect(LIVE_SPEND_HREF).toBe("/rules#live-spend");
  });

  it("fits a one-line reminder on the map hover", () => {
    expect(liveSpendHintShort(HALF_LIFE_DAYS)).toBe(
      `Halves every ${HALF_LIFE_DAYS} days if nobody buys.`,
    );
  });
});
