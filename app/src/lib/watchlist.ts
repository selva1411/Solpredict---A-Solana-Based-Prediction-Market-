import { logger } from "@/lib/logger";
import type { UserSigner } from "@/lib/user-client";

export type WatchlistSigner = UserSigner;

export function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("solpredict-watchlist");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export async function fetchWatchlistFromDb(
  walletPubkey: string,
  _signer?: UserSigner
): Promise<string[]> {
  if (!walletPubkey) return getWatchlist();
  try {
    const res = await fetch(`/api/watchlist?wallet=${walletPubkey}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.keys)) {
      const local = getWatchlist();
      // Union DB keys with local keys so existing stars are never wiped
      const merged = Array.from(new Set([...local, ...data.keys]));
      if (typeof window !== "undefined") {
        localStorage.setItem("solpredict-watchlist", JSON.stringify(merged));
        window.dispatchEvent(
          new CustomEvent("watchlist-updated", { detail: merged })
        );
      }

      // If local has keys that DB doesn't have, sync them to DB in background
      const missingInDb = local.filter((k) => !data.keys.includes(k));
      if (missingInDb.length > 0) {
        for (const k of missingInDb) {
          fetch("/api/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: walletPubkey, marketPubkey: k }),
          }).catch(() => {});
        }
      }

      return merged;
    }
  } catch (e) {
    logger.warn("Failed to fetch watchlist from DB:", e);
  }
  return getWatchlist();
}

export function toggleWatchlist(
  key: string,
  walletPubkey?: string,
  _signer?: UserSigner
): string[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getWatchlist();
    const set = new Set(current);
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    const next = Array.from(set);
    localStorage.setItem("solpredict-watchlist", JSON.stringify(next));

    // Dispatch event so AppContext and all components in this window react immediately
    window.dispatchEvent(
      new CustomEvent("watchlist-updated", { detail: next })
    );

    // Sync with DB in background (fire-and-forget, without prompting wallet signatures)
    if (walletPubkey) {
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletPubkey, marketPubkey: key }),
      }).catch((err) => logger.warn("Watchlist DB sync warning:", err));
    }

    return next;
  } catch {
    return [];
  }
}

export function isWatchlisted(key: string): boolean {
  return getWatchlist().includes(key);
}

/**
 * Remove stale market pubkeys from the local watchlist.
 */
export function pruneWatchlist(validKeys: string[] | Set<string>): string[] {
  if (typeof window === "undefined") return [];
  try {
    const valid = new Set(validKeys);
    if (valid.size === 0) return getWatchlist();
    const current = getWatchlist();
    const next = current.filter((k) => valid.has(k));
    if (next.length !== current.length) {
      localStorage.setItem("solpredict-watchlist", JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent("watchlist-updated", { detail: next })
      );
    }
    return next;
  } catch {
    return getWatchlist();
  }
}

