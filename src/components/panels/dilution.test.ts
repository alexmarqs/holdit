import { describe, expect, it } from "vitest";
import { dilutionDrop, forgetHandle, HELD_KEY, recallHandle, rememberHandle } from "./dilution";

describe("dilutionDrop", () => {
  it("is the shrink, when somebody else bought", () => {
    expect(dilutionDrop(0.1, 0.084)).toBeCloseTo(0.016, 10);
  });

  it("ignores noise and your own top-up", () => {
    expect(dilutionDrop(0.084, 0.084)).toBeNull();
    expect(dilutionDrop(0.084, 0.0844)).toBeNull();
    expect(dilutionDrop(0.05, 0.08)).toBeNull();
  });

  it("ignores a twitch too small to feel", () => {
    expect(dilutionDrop(0.1, 0.0996)).toBeNull();
  });
});

describe("rememberHandle", () => {
  function memory() {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      store,
    };
  }

  it("writes and reads the square this browser just took", () => {
    const storage = memory();
    rememberHandle(storage, "figma.com");
    expect(storage.store.get(HELD_KEY)).toBe("figma.com");
    expect(recallHandle(storage)).toBe("figma.com");
  });

  it("overwrites, so a second company is the only one this tab still watches", () => {
    const storage = memory();
    rememberHandle(storage, "linear.app");
    rememberHandle(storage, "figma.com");
    expect(recallHandle(storage)).toBe("figma.com");
  });

  it("forgets, so this tab stops watching dilution", () => {
    const storage = memory();
    rememberHandle(storage, "figma.com");
    forgetHandle(storage);
    expect(recallHandle(storage)).toBeNull();
    expect(storage.store.has(HELD_KEY)).toBe(false);
  });

  it("survives a missing store", () => {
    expect(recallHandle(null)).toBeNull();
    rememberHandle(null, "figma.com");
    forgetHandle(null);
  });
});
