/**
 * Persistent store for tracking fee withdrawal state per market.
 *
 * Uses the `fee_withdrawn` column in `markets_cache` as the source-of-truth
 * so the state survives server restarts and hot-reloads.  An in-memory Set
 * acts as a process-local cache so repeat reads don't hit the DB.
 */

import { db } from "./client";
import { marketsCache } from "./schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

// Process-local cache: populated lazily when markFeeWithdrawn is called.
const feeWithdrawnSet = new Set<string>();

/**
 * Returns true if fees have been withdrawn for the given market.
 * Checks the local cache first (avoids a DB round-trip during the same
 * request that just called markFeeWithdrawn).
 */
export function isFeeWithdrawn(marketPubkey: string): boolean {
  if (!marketPubkey) return false;
  return feeWithdrawnSet.has(marketPubkey);
}

/**
 * Marks the market as having its fees withdrawn.
 *  1. Updates the local in-memory cache immediately (so the current
 *     request sees the change without waiting for an async DB write).
 *  2. Persists `fee_withdrawn = true` to the DB so future server
 *     instances / hot-reloads also see the correct state.
 */
export function markFeeWithdrawn(marketPubkey: string): void {
  if (!marketPubkey) return;

  // 1. Fast in-process cache
  feeWithdrawnSet.add(marketPubkey);

  // 2. Durable DB write (fire-and-forget; errors are logged but not thrown)
  if (db) {
    db.update(marketsCache)
      .set({ feeWithdrawn: true, updatedAt: new Date() })
      .where(eq(marketsCache.marketPubkey, marketPubkey))
      .catch((err: unknown) => {
        logger.warn(`markFeeWithdrawn DB write failed for ${marketPubkey}:`, err);
      });
  }
}

/**
 * Warm the in-memory cache from the DB on startup / first use.
 * Called once by the data layer so `isFeeWithdrawn` can serve reads
 * without a DB query.
 */
export async function warmFeeWithdrawnCache(): Promise<void> {
  if (!db) return;
  try {
    const rows = await db
      .select({ marketPubkey: marketsCache.marketPubkey })
      .from(marketsCache)
      .where(eq(marketsCache.feeWithdrawn, true));

    for (const row of rows) {
      feeWithdrawnSet.add(row.marketPubkey);
    }
  } catch (err) {
    logger.warn("warmFeeWithdrawnCache failed:", err);
  }
}
