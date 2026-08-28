import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../client";
import { getMapState } from "./map";

const { loadMapRows } = vi.hoisted(() => ({ loadMapRows: vi.fn() }));

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
  beforeEach(() => {
    loadMapRows.mockReset();
    loadMapRows.mockImplementation(async () => empty());
  });

  it("holds nothing between requests, so no instance can serve a stale wall", async () => {
    await getMapState(db, { now: 1_000 });
    await getMapState(db, { now: 1_001 });
    await getMapState(db, { now: 1_002 });
    expect(loadMapRows).toHaveBeenCalledTimes(3);
  });

  it("collapses simultaneous loads into one query", async () => {
    await Promise.all([
      getMapState(db, { now: 2_000 }),
      getMapState(db, { now: 2_000 }),
      getMapState(db, { now: 2_000 }),
    ]);
    expect(loadMapRows).toHaveBeenCalledTimes(1);
  });

  it("does not wedge after a failed load", async () => {
    loadMapRows.mockRejectedValueOnce(new Error("database down"));
    await expect(getMapState(db, { now: 3_000 })).rejects.toThrow("database down");
    await expect(getMapState(db, { now: 3_000 })).resolves.toBeDefined();
    expect(loadMapRows).toHaveBeenCalledTimes(2);
  });

  it("does not let a print stamp share the live wall's query", async () => {
    await Promise.all([getMapState(db), getMapState(db, { now: 9_000 })]);
    expect(loadMapRows).toHaveBeenCalledTimes(2);
  });

  it("does not collapse two different stamps into one query", async () => {
    await Promise.all([getMapState(db, { now: 1_000 }), getMapState(db, { now: 9_000 })]);
    expect(loadMapRows).toHaveBeenCalledTimes(2);
  });

  it("collapses simultaneous live loads without a stamp", async () => {
    await Promise.all([getMapState(db), getMapState(db), getMapState(db)]);
    expect(loadMapRows).toHaveBeenCalledTimes(1);
  });
});
