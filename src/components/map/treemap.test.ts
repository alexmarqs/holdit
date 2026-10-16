import type { HolderStanding, MapState } from "@holdit/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WallProvider } from "@/context/wall-provider";
import { Treemap } from "./treemap";

const NOW = Date.UTC(2026, 7, 22, 11, 37);

function standing(handle: string, share: number): HolderStanding {
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
    lastPurchaseId: null,
    share,
    rawShare: share,
    capped: false,
    floored: false,
  };
}

function state(standings: HolderStanding[]): MapState {
  return {
    standings,
    counters: {
      onlineNow: null,
      clicksAllTime: 0,
      visitorsSinceLaunch: 0,
      liveCents: 100_000,
      squaresLive: standings.length,
    },
    activity: [],
    trending: [],
    generatedAt: NOW,
  };
}

describe("Treemap first paint", () => {
  it("ships squares in the HTML, before the canvas has been measured", () => {
    const html = renderToStaticMarkup(
      createElement(WallProvider, {
        initialState: state([standing("acme.com", 0.6), standing("other.dev", 0.4)]),
        // biome-ignore lint/correctness/noChildrenProp: the third createElement argument does not satisfy a required children prop
        children: createElement(Treemap),
      }),
    );

    expect(html).toContain("map-fit-a");
    expect(html).toContain("map-fit-c");
    expect(html).toContain('aria-label="acme.com"');
    expect(html).toContain('aria-label="other.dev"');
    expect(html).not.toMatch(/class="map-canvas[^"]*"><\/div>/);
  });
});
