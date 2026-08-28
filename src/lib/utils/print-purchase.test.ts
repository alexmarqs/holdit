import { describe, expect, it } from "vitest";
import { parsePurchasePrintId } from "./print-purchase";

describe("parsePurchasePrintId", () => {
  it("accepts a purchase UUID", () => {
    expect(parsePurchasePrintId("11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("rejects a time-bucket stamp so /print/p cannot be flooded", () => {
    expect(parsePurchasePrintId(String(Date.UTC(2026, 7, 22, 11, 37)))).toBeNull();
    expect(parsePurchasePrintId("nope")).toBeNull();
  });
});
