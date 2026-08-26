import { buildMapState } from "@holdit/core";
import { describe, expect, it } from "vitest";
import { wallInput } from "@/core/wall-input";
import { createWallQueryClient, WALL_QUERY_KEY, writeWallCache } from "./wall-query";

const NOW = 1_700_000_000_000;

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
