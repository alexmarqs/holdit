import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../client";

const loadMapRows = vi.fn();

vi.mock("./dataset", () => ({ loadMapRows }));

const db = {} as Database;

const empty = () => ({
  holders: [],
  purchasesByHolder: new Map(),
  clicksAllTimeByHolder: new Map(),
  clicksLastHourByHolder: new Map(),
  activity: [],
  visitorsSinceLaunch: 0,
  onlineNow: 0,
});

describe("getMapState", () => {
  beforeEach(async () => {
    loadMapRows.mockReset();
    loadMapRows.mockImplementation(async () => empty());
    const { resetMapRowsCache } = await import("./map");
    resetMapRowsCache();
  });

  it("holds nothing between requests, so no instance can serve a stale wall", async () => {
    const { getMapState } = await import("./map");
    await getMapState(db, { now: 1_000 });
    await getMapState(db, { now: 1_001 });
    await getMapState(db, { now: 1_002 });
    expect(loadMapRows).toHaveBeenCalledTimes(3);
  });

  it("collapses simultaneous loads into one query", async () => {
    const { getMapState } = await import("./map");
    await Promise.all([
      getMapState(db, { now: 2_000 }),
      getMapState(db, { now: 2_000 }),
      getMapState(db, { now: 2_000 }),
    ]);
    expect(loadMapRows).toHaveBeenCalledTimes(1);
  });

  it("does not wedge after a failed load", async () => {
    const { getMapState } = await import("./map");
    loadMapRows.mockRejectedValueOnce(new Error("database down"));
    await expect(getMapState(db, { now: 3_000 })).rejects.toThrow("database down");
    await expect(getMapState(db, { now: 3_001 })).resolves.toBeDefined();
    expect(loadMapRows).toHaveBeenCalledTimes(2);
  });
});
