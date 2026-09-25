import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage and window in node test environment
class LocalStorageMock {
  store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockStorage = new LocalStorageMock();
(globalThis as any).localStorage = mockStorage;
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}
(globalThis as any).window.localStorage = mockStorage;
(globalThis as any).window.dispatchEvent = vi.fn();
(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, params?: { detail?: any }) {
    this.type = type;
    this.detail = params?.detail;
  }
};

import {
  getWatchlist,
  toggleWatchlist,
  isWatchlisted,
  pruneWatchlist,
} from "./watchlist";

describe("watchlist utility", () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns empty array initially", () => {
    expect(getWatchlist()).toEqual([]);
  });

  it("toggles item addition and removal", () => {
    const key = "marketPubkey123";
    expect(isWatchlisted(key)).toBe(false);

    const added = toggleWatchlist(key);
    expect(added).toContain(key);
    expect(isWatchlisted(key)).toBe(true);

    const removed = toggleWatchlist(key);
    expect(removed).not.toContain(key);
    expect(isWatchlisted(key)).toBe(false);
  });

  it("dispatches watchlist-updated custom event on toggle", () => {
    const dispatchFn = vi.fn();
    (globalThis as any).window.dispatchEvent = dispatchFn;
    toggleWatchlist("market456");

    expect(dispatchFn).toHaveBeenCalled();
    const event = dispatchFn.mock.calls[0][0] as any;
    expect(event.type).toBe("watchlist-updated");
    expect(event.detail).toContain("market456");
  });

  it("pruneWatchlist preserves valid keys and drops invalid ones", () => {
    toggleWatchlist("validKey1");
    toggleWatchlist("validKey2");
    toggleWatchlist("deadKey");

    const valid = new Set(["validKey1", "validKey2"]);
    const pruned = pruneWatchlist(valid);

    expect(pruned).toContain("validKey1");
    expect(pruned).toContain("validKey2");
    expect(pruned).not.toContain("deadKey");
    expect(getWatchlist()).toEqual(["validKey1", "validKey2"]);
  });
});
