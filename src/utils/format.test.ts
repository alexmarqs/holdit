import { describe, expect, it } from "vitest";
import { formatAgo, formatMoney, formatPrintDate, formatShare, moneyDraft } from "./format";

const NOW = Date.UTC(2026, 7, 21, 12);

describe("formatMoney", () => {
  it("renders whole dollars with separators", () => {
    expect(formatMoney(1_900)).toBe("$19");
    expect(formatMoney(3_841_000)).toBe("$38,410");
    expect(formatMoney(0)).toBe("$0");
  });
});

describe("formatShare", () => {
  it("renders a percentage at the requested precision", () => {
    expect(formatShare(0.042)).toBe("4.2%");
    expect(formatShare(0.042, 2)).toBe("4.20%");
  });

  it("never rounds a measured share up onto the ceiling", () => {
    // 9.97% used to print "10.0%", so decrementing $1 off the 10% chip looked
    // like a stuck control: the dollars moved and the share did not.
    expect(formatShare(0.0997)).toBe("9.97%");
    expect(formatShare(0.1)).toBe("10.0%");
  });

  it("never rounds a measured share up onto a tenth it has not reached", () => {
    expect(formatShare(0.04966)).toBe("4.97%");
    expect(formatShare(0.05)).toBe("5.0%");
  });

  it("keeps a non-zero extra digit so a dollar step does not look stuck", () => {
    // 9.93% used to print "9.9%", the same label as 9.90%. Another $1 off the
    // 10% chip then looked like a dead control: the dollars moved and the
    // share did not. A clean tenth still collapses.
    expect(formatShare(0.0993)).toBe("9.93%");
    expect(formatShare(0.099)).toBe("9.9%");
    expect(formatShare(0.042)).toBe("4.2%");
    expect(formatShare(0.003719)).toBe("0.37%");
    expect(formatShare(0.03305)).toBe("3.3%");
  });
});

describe("formatAgo", () => {
  it("collapses anything recent to 'just now'", () => {
    expect(formatAgo(NOW, NOW)).toBe("just now");
    expect(formatAgo(NOW - 20_000, NOW)).toBe("just now");
  });

  it("steps through seconds, minutes, hours and days", () => {
    expect(formatAgo(NOW - 50_000, NOW)).toBe("50s");
    expect(formatAgo(NOW - 300_000, NOW)).toBe("5m");
    expect(formatAgo(NOW - 7_200_000, NOW)).toBe("2h");
    expect(formatAgo(NOW - 3 * 86_400_000, NOW)).toBe("3d");
  });

  it("never renders a negative age", () => {
    expect(formatAgo(NOW + 60_000, NOW)).toBe("just now");
  });
});

describe("formatPrintDate", () => {
  it("prints the UTC instant so the receipt names the timezone", () => {
    expect(formatPrintDate(Date.UTC(2026, 7, 22, 11, 37))).toBe("Aug 22, 2026, 11:37 UTC");
  });
});

describe("formatMoney under a dollar", () => {
  it("keeps the cents so a decayed square does not read as dead", () => {
    expect(formatMoney(30)).toBe("$0.30");
    expect(formatMoney(1)).toBe("$0.01");
  });

  it("keeps whole dollars without cents", () => {
    expect(formatMoney(100)).toBe("$1");
    expect(formatMoney(2_600)).toBe("$26");
  });

  it("prints the exact cents a chip would charge, not a rounded dollar", () => {
    expect(formatMoney(2_570)).toBe("$25.70");
    expect(formatMoney(2_649)).toBe("$26.49");
  });

  it("edits as the same number the label shows", () => {
    expect(moneyDraft(2_570)).toBe("25.70");
    expect(moneyDraft(2_600)).toBe("26");
  });

  it("shows a genuinely empty square as $0", () => {
    expect(formatMoney(0)).toBe("$0");
  });
});
