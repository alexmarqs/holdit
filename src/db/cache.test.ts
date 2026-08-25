import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "./client";

const loadMapDataset = vi.fn();

vi.mock("./queries/dataset", () => ({ loadMapDataset }));

// The collapse is about promise identity, not about the client — the query it
// wraps is mocked out, so nothing here connects to anything.
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

describe("loadDataset", () => {
  beforeEach(() => {
    loadMapDataset.mockReset();
    loadMapDataset.mockImplementation(async () => empty());
  });

  it("holds nothing between requests, so no instance can serve a stale wall", async () => {
    const { loadDataset } = await import("./cache");
    await loadDataset(db, 1_000);
    await loadDataset(db, 1_001);
    await loadDataset(db, 1_002);
    // A per-instance cache would answer the later calls from memory, which is
    // exactly how two servers end up disagreeing about the same wall.
    expect(loadMapDataset).toHaveBeenCalledTimes(3);
  });

  it("collapses simultaneous loads into one query", async () => {
    const { loadDataset } = await import("./cache");
    await Promise.all([loadDataset(db, 2_000), loadDataset(db, 2_000), loadDataset(db, 2_000)]);
    expect(loadMapDataset).toHaveBeenCalledTimes(1);
  });

  it("does not wedge after a failed load", async () => {
    const { loadDataset } = await import("./cache");
    loadMapDataset.mockRejectedValueOnce(new Error("database down"));
    await expect(loadDataset(db, 3_000)).rejects.toThrow("database down");

    // The next request must be able to try again.
    await expect(loadDataset(db, 3_001)).resolves.toBeDefined();
    expect(loadMapDataset).toHaveBeenCalledTimes(2);
  });
});
