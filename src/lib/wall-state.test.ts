import { buildMapState } from "@holdit/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wallInput } from "@/core/wall-input";
import {
  CHASE_GIVE_UP_MS,
  chaseTimedOut,
  claimedSquare,
  createWallQueryClient,
  fetchWall,
  heldHandleFromHref,
  hrefWithoutHeld,
  tryFetchWall,
  WALL_QUERY_KEY,
  WALL_STALE_HINT_MS,
  WALL_STALE_WARN_MS,
  wallStaleAgo,
  wallStaleWarn,
  wallStateUrl,
  writeWallCache,
} from "./wall-state";

const NOW = 1_700_000_000_000;

describe("wallStateUrl", () => {
  it("asks the shared edge copy by default", () => {
    expect(wallStateUrl(false)).toBe("/api/state");
  });

  it("busts the CDN with a unique stamp when the purchase must be visible", () => {
    expect(wallStateUrl(true, NOW)).toBe(`/api/state?fresh=${NOW}`);
  });
});

describe("fetchWall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not tell the browser to skip cache on a routine look", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ standings: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchWall(false);

    expect(fetchMock).toHaveBeenCalledWith("/api/state", undefined);
  });

  it("skips stored copies when chasing a paid square", async () => {
    vi.setSystemTime(NOW);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ standings: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchWall(true);

    expect(fetchMock).toHaveBeenCalledWith(`/api/state?fresh=${NOW}`, { cache: "no-store" });
  });

  it("leaves the current wall in place when the pull fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }),
    );
    await expect(fetchWall()).rejects.toThrow("Wall unavailable (502)");
  });
});

describe("tryFetchWall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the wall when the pull succeeds", async () => {
    const wall = { standings: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => wall }));
    await expect(tryFetchWall(true)).resolves.toEqual(wall);
  });

  it("skips a 429 without throwing, so Refresh can stay silent", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({ error: "Too many requests" }),
        }),
    );
    await expect(tryFetchWall(true)).resolves.toBeNull();
  });

  it("skips a dead origin the same way", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(tryFetchWall(true)).resolves.toBeNull();
  });
});

describe("heldHandleFromHref", () => {
  it("reads the handle checkout put on the URL", () => {
    expect(heldHandleFromHref("https://holdit.lol/?held=stripe.com")).toBe("stripe.com");
  });

  it("ignores an empty or missing parameter", () => {
    expect(heldHandleFromHref("https://holdit.lol/")).toBeNull();
    expect(heldHandleFromHref("https://holdit.lol/?held=")).toBeNull();
  });
});

describe("hrefWithoutHeld", () => {
  it("drops held so a reload does not chase again", () => {
    expect(hrefWithoutHeld("https://holdit.lol/?held=stripe.com")).toBe("/");
  });

  it("keeps anything else on the query", () => {
    expect(hrefWithoutHeld("https://holdit.lol/?held=stripe.com&x=1")).toBe("/?x=1");
  });
});

describe("claimedSquare", () => {
  const wall = buildMapState(
    wallInput(
      [
        { handle: "stripe.com", cents: 5_000 },
        { handle: "linear.app", cents: 1_000 },
      ],
      { now: NOW },
    ),
  );

  it("is the standing once the webhook has landed", () => {
    const claimed = claimedSquare(wall, "stripe.com");
    expect(claimed?.handle).toBe("stripe.com");
    expect(claimed?.share).toBeGreaterThan(0);
  });

  it("is null while the square is still on its way", () => {
    expect(claimedSquare(wall, "missing.com")).toBeNull();
  });
});

describe("wallStaleAgo", () => {
  it("stays quiet while the snapshot is still fresh", () => {
    expect(wallStaleAgo(NOW, NOW + WALL_STALE_HINT_MS - 1)).toBeNull();
  });

  it("names the age once the tab has been sitting on a copy", () => {
    expect(wallStaleAgo(NOW, NOW + WALL_STALE_HINT_MS)).toBe("2m");
    expect(wallStaleAgo(NOW, NOW + 5 * 60_000)).toBe("5m");
  });
});

describe("wallStaleWarn", () => {
  it("stays muted through a short sit", () => {
    expect(wallStaleWarn(NOW, NOW + WALL_STALE_WARN_MS - 1)).toBe(false);
  });

  it("warms up once they have been sitting on a live product", () => {
    expect(wallStaleWarn(NOW, NOW + WALL_STALE_WARN_MS)).toBe(true);
  });
});

describe("chaseTimedOut", () => {
  it("keeps asking through the forty-second window", () => {
    expect(chaseTimedOut(NOW, NOW + CHASE_GIVE_UP_MS)).toBe(false);
  });

  it("gives up once silence would read as a lost payment", () => {
    expect(chaseTimedOut(NOW, NOW + CHASE_GIVE_UP_MS + 1)).toBe(true);
  });
});

describe("the query cache", () => {
  const wall = buildMapState(wallInput([{ handle: "stripe.com", cents: 1_000 }], { now: NOW }));

  it("seeds the prerendered wall so the first paint does not fetch", () => {
    const client = createWallQueryClient(wall);
    expect(client.getQueryData(WALL_QUERY_KEY)).toBe(wall);
  });

  it("replaces that copy when a pull lands, under one key", () => {
    const client = createWallQueryClient(wall);
    const next = buildMapState(
      wallInput(
        [
          { handle: "stripe.com", cents: 1_000 },
          { handle: "linear.app", cents: 5_000 },
        ],
        { now: NOW },
      ),
    );
    writeWallCache(client, next);
    expect(client.getQueryData(WALL_QUERY_KEY)).toEqual(next);
  });
});
