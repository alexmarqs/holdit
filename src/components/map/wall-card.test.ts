import { type HolderStanding, type MapState, MIN_TILE_AREA, tileContent } from "@holdit/core";
import { describe, expect, it } from "vitest";
import { shortHandle } from "@/lib/utils/domain";
import { placeWall } from "./place-wall";
import { tileColor, WALL_CARD_MAP, wallCardModel } from "./wall-card";

const NOW = Date.UTC(2026, 7, 22, 11, 37);

function standing(
  handle: string,
  share: number,
  extras: Partial<HolderStanding> = {},
): HolderStanding {
  return {
    holder: {
      id: handle,
      handle,
      url: `https://${handle}`,
      tagline: null,
      createdAt: NOW,
    },
    liveCents: Math.round(share * 100_000),
    allTimeCents: Math.round(share * 100_000),
    clicksAllTime: 0,
    lastPurchaseAt: NOW,
    share,
    rawShare: share,
    capped: false,
    floored: false,
    ...extras,
  };
}

function state(standings: HolderStanding[], liveCents = 1_240_000): MapState {
  return {
    standings,
    counters: {
      onlineNow: null,
      clicksAllTime: 0,
      visitorsSinceLaunch: 0,
      liveCents,
      squaresLive: standings.filter((s) => s.share > 0).length,
    },
    activity: [],
    trending: [],
    generatedAt: NOW,
  };
}

describe("wallCardModel", () => {
  it("prints the live totals so the picture is a receipt", () => {
    const card = wallCardModel(state([standing("acme.com", 0.7), standing("other.dev", 0.3)]));
    expect(card.stats).toBe("$12,400 live · 2 squares");
    expect(card.date).toBe("Aug 22, 2026, 11:37 UTC");
    expect(card).not.toHaveProperty("footer");
  });

  it("gives the biggest share the biggest tile — the reason you save it", () => {
    const card = wallCardModel(state([standing("other.dev", 0.3), standing("acme.com", 0.7)]));
    const acme = card.tiles.find((t) => t.handle === "acme.com");
    const other = card.tiles.find((t) => t.handle === "other.dev");
    expect(acme).toBeDefined();
    expect(other).toBeDefined();
    expect(acme!.w * acme!.h).toBeGreaterThan(other!.w * other!.h);
    expect(acme!.name).toBe("acme.com");
    expect(acme!.meta).toContain("%");
    expect(acme!.logoUrl).toContain("acme.com");
    expect(acme!.showLogo).toBe(true);
  });

  it("names squares the old 168×78 gate would have left blank", () => {
    const standings = Array.from({ length: 45 }, (_, index) =>
      standing(`site${index}.com`, 0.88 ** index),
    );
    const card = wallCardModel(state(standings, 450_000));
    const named = card.tiles.filter((tile) => tile.name !== null);
    const oldGate = card.tiles.filter((tile) => tile.w > 168 && tile.h > 78);

    expect(named.length).toBeGreaterThan(oldGate.length);
  });

  it("drops squares that have no area left", () => {
    const card = wallCardModel(state([standing("acme.com", 0.8), standing("gone.dev", 0)], 80_000));
    expect(card.tiles.map((t) => t.handle)).toEqual(["acme.com"]);
  });

  it("paints a fresh buy warmer than a cold one", () => {
    const card = wallCardModel(
      state([
        standing("hot.com", 0.5, { lastPurchaseAt: NOW }),
        standing("cold.com", 0.5, { lastPurchaseAt: NOW - 20 * 86_400_000 }),
      ]),
    );
    const hot = card.tiles.find((t) => t.handle === "hot.com")!;
    const cold = card.tiles.find((t) => t.handle === "cold.com")!;
    expect(hot.color).not.toBe(cold.color);
  });
});

/**
 * The download is a picture of the wall, so it has to obey the wall's rules.
 * Each of these was a way the saved image differed from what was on screen.
 */
describe("the card matches the live wall", () => {
  const many = Array.from({ length: 20 }, (_, i) => standing(`s${i}.com`, (20 - i) / 210));

  it("draws a mark on every tile, as the wall does", () => {
    for (const tile of wallCardModel(state(many)).tiles) {
      expect(tile.logoUrl, tile.handle).not.toBeNull();
      expect(tile.showLogo, tile.handle).toBe(true);
    }
  });

  it("applies the same minimum-tile floor, so the tail is not smaller here", () => {
    const tiles = wallCardModel(state(many)).tiles;
    const smallest = Math.min(...tiles.map((t) => t.w * t.h));
    // Tiles are inset by 2px a side, so allow for that against the raw floor.
    expect(smallest).toBeGreaterThan(MIN_TILE_AREA * 0.5);
    expect(tiles.every((t) => t.w > 0 && t.h > 0)).toBe(true);
  });

  it("writes the same stat line the tile writes, and holds the same floor", () => {
    const card = wallCardModel(
      state([
        standing("busy.com", 0.6, { clicksAllTime: 412 }),
        standing("quiet.com", 0.3, { clicksAllTime: 2 }),
        standing("silent.com", 0.1),
      ]),
    );
    expect(card.tiles.find((t) => t.handle === "busy.com")?.meta).toBe("60.0% · 412 clicks");
    // Under the floor and at zero both print the share alone — never "· 2 clicks",
    // which reads as nobody goes there.
    expect(card.tiles.find((t) => t.handle === "quiet.com")?.meta).toBe("30.0%");
    expect(card.tiles.find((t) => t.handle === "silent.com")?.meta).toBe("10.0%");
  });

  it("takes its names from tileContent rather than a second set of rules", () => {
    for (const tile of wallCardModel(state(many)).tiles) {
      const face = tileContent(tile.w, tile.h, {
        short: shortHandle(tile.handle),
        full: tile.handle,
      });
      expect(tile.name, tile.handle).toBe(face.spine ? tile.handle : face.name);
      expect(tile.nameFontPx, tile.handle).toBe(face.nameFontPx);
      expect(tile.showStats, tile.handle).toBe(face.stats);
      expect(tile.logoPx, tile.handle).toBe(face.logoPx);
    }
  });

  it("fills the card's map area and nothing outside it", () => {
    for (const tile of wallCardModel(state(many)).tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.w).toBeLessThanOrEqual(WALL_CARD_MAP.w + 1);
      expect(tile.y + tile.h).toBeLessThanOrEqual(WALL_CARD_MAP.h + 1);
    }
  });
});

/**
 * The download is the wall, not a second drawing of the same data. Given the
 * canvas the browser is using, the card must place every square exactly where
 * the browser placed it — this recomputes the layout the way `Treemap` does and
 * compares, so any future divergence in either fails here rather than in a
 * screenshot somebody happens to look at.
 */
describe("card layout equals wall layout at the same canvas size", () => {
  const wall = state(
    Array.from({ length: 24 }, (_, i) =>
      standing(`s${i}.com`, (24 - i) / 300, { clicksAllTime: 400 }),
    ),
  );

  /** Exactly the steps `Treemap` takes to place its tiles. */
  function wallTiles(w: number, h: number) {
    return placeWall(
      wall.standings.map((s) => ({ id: s.holder.id, share: s.share })),
      { w, h },
    ).tiles;
  }

  it("places every square the way the live wall would at the card's own size", () => {
    const { w, h } = WALL_CARD_MAP;
    const onScreen = new Map(wallTiles(w, h).map((t) => [t.id, t]));
    for (const tile of wallCardModel(wall).tiles) {
      const same = onScreen.get(tile.id);
      expect(same, tile.handle).toBeDefined();
      // The card insets each tile by 1px a side for its gutter.
      expect(Math.round(tile.x - 1), tile.handle).toBe(Math.round(same!.x));
      expect(Math.round(tile.y - 1), tile.handle).toBe(Math.round(same!.y));
      expect(Math.round(tile.w + 2), tile.handle).toBe(Math.round(same!.w));
      expect(Math.round(tile.h + 2), tile.handle).toBe(Math.round(same!.h));
    }
  });

  it("keeps the unfurl at the 1200x630 a social card needs", () => {
    const card = wallCardModel(wall);
    expect(card.size).toEqual({ width: 1200, height: 630 });
    expect(card.map.h).toBe(630 - card.header);
  });

  it("carries a theme across", () => {
    expect(wallCardModel(wall, "dark").theme).toBe("dark");
    expect(wallCardModel(wall).theme).toBe("light");
    // The heat channel mixes far less far in the dark, as the wall does.
    expect(tileColor(1, "dark")).not.toBe(tileColor(1, "light"));
  });
});
