import { buildMapState } from "@holdit/core";
import { describe, expect, it } from "vitest";
import { wallInput } from "@/core/wall-input";
import {
  CHASE_GIVE_UP_MS,
  chaseTimedOut,
  claimedSquare,
  heldHandleFromHref,
  hrefWithoutHeld,
  WALL_STALE_HINT_MS,
  WALL_STALE_WARN_MS,
  wallStaleAgo,
  wallStaleWarn,
} from "./wall-state";

const NOW = 1_700_000_000_000;

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
