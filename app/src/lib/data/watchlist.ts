import { db } from "@/lib/db/client";
import { watchlist } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const inMemoryWatchlists = new Map<string, Set<string>>();

export async function getWatchlistKeys(wallet: string): Promise<string[]> {
  if (!db) {
    return Array.from(inMemoryWatchlists.get(wallet) || []);
  }
  try {
    const items = await db
      .select({ marketPubkey: watchlist.marketPubkey })
      .from(watchlist)
      .where(eq(watchlist.wallet, wallet));
    return items.map((i) => i.marketPubkey);
  } catch (err) {
    console.warn("[Watchlist DB] Failed to query watchlist, using memory fallback:", err);
    return Array.from(inMemoryWatchlists.get(wallet) || []);
  }
}

/** Toggle: returns true if the market is now watched, false if removed. */
export async function toggleWatch(
  wallet: string,
  marketPubkey: string
): Promise<boolean> {
  if (!db) {
    let set = inMemoryWatchlists.get(wallet);
    if (!set) {
      set = new Set<string>();
      inMemoryWatchlists.set(wallet, set);
    }
    if (set.has(marketPubkey)) {
      set.delete(marketPubkey);
      return false;
    } else {
      set.add(marketPubkey);
      return true;
    }
  }
  try {
    const existing = await db
      .select()
      .from(watchlist)
      .where(
        and(
          eq(watchlist.wallet, wallet),
          eq(watchlist.marketPubkey, marketPubkey)
        )
      );

    if (existing.length > 0) {
      await db
        .delete(watchlist)
        .where(
          and(
            eq(watchlist.wallet, wallet),
            eq(watchlist.marketPubkey, marketPubkey)
          )
        );
      return false;
    }

    await db
      .insert(watchlist)
      .values({ wallet, marketPubkey, createdAt: new Date() })
      .onConflictDoNothing();
    return true;
  } catch (err) {
    console.warn("[Watchlist DB] Failed toggle in DB, using memory fallback:", err);
    let set = inMemoryWatchlists.get(wallet);
    if (!set) {
      set = new Set<string>();
      inMemoryWatchlists.set(wallet, set);
    }
    if (set.has(marketPubkey)) {
      set.delete(marketPubkey);
      return false;
    } else {
      set.add(marketPubkey);
      return true;
    }
  }
}

/** Unconditional removal (used to purge dead market pubkeys). */
export async function removeWatch(
  wallet: string,
  marketPubkey: string
): Promise<void> {
  if (!db) {
    inMemoryWatchlists.get(wallet)?.delete(marketPubkey);
    return;
  }
  try {
    await db
      .delete(watchlist)
      .where(
        and(
          eq(watchlist.wallet, wallet),
          eq(watchlist.marketPubkey, marketPubkey)
        )
      );
  } catch (err) {
    console.warn("[Watchlist DB] Failed removeWatch in DB, using memory fallback:", err);
    inMemoryWatchlists.get(wallet)?.delete(marketPubkey);
  }
}

