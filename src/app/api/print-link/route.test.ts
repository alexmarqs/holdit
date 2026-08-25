import { afterEach, describe, expect, it, vi } from "vitest";

process.env.CLICK_HASH_SALT = process.env.CLICK_HASH_SALT ?? "test-print-secret";

const { POST } = await import("./route");
const { parsePrintAt } = await import("@holdit/utils/print-at");
const { serverEnv } = await import("@holdit/utils/env");

function post(body: unknown) {
  return POST(
    new Request("https://holdit.lol/api/print-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/print-link", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("mints a proof for a stamp from the last few minutes", async () => {
    const now = Date.UTC(2026, 7, 22, 11, 37);
    vi.setSystemTime(now);
    const at = now - 1_000;
    const response = await post({ at });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.at).toBe(at);
    expect(
      parsePrintAt(String(at), now, { proof: body.proof, secret: serverEnv.clickHashSalt }),
    ).toBe(at);
  });

  it("refuses a stamp from an hour ago", async () => {
    const now = Date.UTC(2026, 7, 22, 11, 37);
    vi.setSystemTime(now);
    const response = await post({ at: now - 60 * 60_000 });
    expect(response.status).toBe(400);
  });
});
