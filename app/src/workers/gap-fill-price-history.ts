/**
 * ENH-5: Price History Gap-Fill Worker
 *
 * Detects missing 5-minute intervals in price_history due to indexer restarts,
 * downtime, or RPC rate-limiting, and fills the gaps carrying forward the
 * nearest previous price point so sparklines and charts have contiguous data.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx src/workers/gap-fill-price-history.ts
 */
import { getDb } from "@/lib/db/client";
import { priceHistory, marketsCache } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export async function gapFillPriceHistory(marketPubkeyFilter?: string): Promise<{
  marketsChecked: number;
  ticksInserted: number;
}> {
  const db = getDb();
  if (!db) {
    logger.warn("[GapFill] Database unavailable, skipping");
    return { marketsChecked: 0, ticksInserted: 0 };
  }

  // Find markets to check
  const marketsQuery = marketPubkeyFilter
    ? await db
        .select({ marketPubkey: marketsCache.marketPubkey })
        .from(marketsCache)
        .where(eq(marketsCache.marketPubkey, marketPubkeyFilter))
    : await db.select({ marketPubkey: marketsCache.marketPubkey }).from(marketsCache);

  let totalInserted = 0;

  for (const m of marketsQuery) {
    const pubkey = m.marketPubkey;
    const ticks = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.marketPubkey, pubkey))
      .orderBy(asc(priceHistory.timestamp));

    if (ticks.length < 2) continue;

    const toInsert: Array<{
      marketPubkey: string;
      outcomeIndex: number;
      timestamp: Date;
      priceBps: number;
      volume: string;
    }> = [];

    for (let i = 0; i < ticks.length - 1; i++) {
      const current = ticks[i];
      const next = ticks[i + 1];

      const currentMs = new Date(current.timestamp).getTime();
      const nextMs = new Date(next.timestamp).getTime();
      const diffMs = nextMs - currentMs;

      // If gap exceeds 5 minutes, fill with 5-minute intervals
      if (diffMs > FIVE_MINUTES_MS) {
        let cursorMs = currentMs + FIVE_MINUTES_MS;
        const currentPrice = current.priceBps ?? 5000;
        const nextPrice = next.priceBps ?? currentPrice;

        while (cursorMs < nextMs) {
          // Linear interpolation between last tick and next tick
          const progress = (cursorMs - currentMs) / diffMs;
          const interpolatedPrice = Math.round(
            currentPrice + (nextPrice - currentPrice) * progress
          );

          toInsert.push({
            marketPubkey: pubkey,
            outcomeIndex: current.outcomeIndex ?? 0,
            timestamp: new Date(cursorMs),
            priceBps: interpolatedPrice,
            volume: "0",
          });

          cursorMs += FIVE_MINUTES_MS;

          // Cap interpolation per gap to avoid giant batch in case of multi-month gaps
          if (toInsert.length >= 500) break;
        }
      }
    }

    if (toInsert.length > 0) {
      await db.insert(priceHistory).values(toInsert);
      totalInserted += toInsert.length;
      logger.info(
        `[GapFill] Market ${pubkey}: filled ${toInsert.length} missing 5-minute price ticks`
      );
    }
  }

  logger.info(
    `[GapFill] Completed. Checked ${marketsQuery.length} markets, inserted ${totalInserted} ticks.`
  );
  return { marketsChecked: marketsQuery.length, ticksInserted: totalInserted };
}

// Direct execution CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  gapFillPriceHistory()
    .then((res) => {
      console.log(`Gap-fill finished: ${JSON.stringify(res)}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Gap-fill error:", err);
      process.exit(1);
    });
}
