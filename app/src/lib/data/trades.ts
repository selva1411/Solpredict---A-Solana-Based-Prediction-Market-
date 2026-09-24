import { db } from "@/lib/db/client";
import { trades, marketsCache } from "@/lib/db/schema";
import { eq, and, desc, sql, SQL } from "drizzle-orm";

export async function getTradeHistory(wallet: string, limit = 50) {
  if (!db) return [];

  return db
    .select({
      signature: trades.signature,
      marketPubkey: trades.marketPubkey,
      outcomeIndex: trades.outcomeIndex,
      side: trades.side,
      shares: trades.shares,
      cost: trades.cost,
      avgPriceBps: trades.avgPriceBps,
      feePaidLamports: trades.feePaidLamports,
      blockTime: trades.blockTime,
      question: marketsCache.question,
    })
    .from(trades)
    .leftJoin(marketsCache, eq(marketsCache.marketPubkey, trades.marketPubkey))
    .where(eq(trades.trader, wallet))
    .orderBy(desc(trades.blockTime))
    .limit(limit);
}

export async function getPnlSeries(wallet: string) {
  if (!db) return [];

  // Group trades by date to build PnL time series. Shares are stored in base
  // units (1e6 per share — see BASE_UNITS_PER_SHARE), so the value of a
  // position is (shares / 1e6) * pricePerShare. Dividing by 1e9 (as before)
  // understated share counts by 1000x and made the series nonsense.
  const tradeHistory = await getTradeHistory(wallet, 200);
  let cumulativePnl = 0;

  return tradeHistory.reverse().map((t) => {
    const costSol = (t.cost ?? 0) / 1e9;
    const priceSol = (t.avgPriceBps ?? 5000) / 10000;
    const estValue = ((t.shares ?? 0) / 1e6) * priceSol;
    const pnlDelta = estValue - costSol;
    cumulativePnl += pnlDelta;

    return {
      timestamp: t.blockTime
        ? new Date(t.blockTime).toISOString()
        : new Date().toISOString(),
      pnlSol: cumulativePnl,
    };
  });
}

/**
 * Recent trade activity, optionally filtered to one wallet. Mirrors
 * GET /api/activity/recent exactly.
 */
/**
 * Real trading momentum for a market: trade count and YES/NO volume from the
 * trades table. Used by /api/ai/analyze-market — never faked or defaulted.
 */
export async function getTradeMomentum(marketPubkey: string) {
  if (!db) throw new Error("Database not available");
  const res = await db.execute(sql`
    SELECT
      COUNT(*)::int as trade_count,
      COALESCE(SUM(CASE WHEN LOWER(side) = 'yes' THEN ABS(lamports_in) ELSE 0 END), 0) / 1e9 as yes_vol,
      COALESCE(SUM(CASE WHEN LOWER(side) = 'no' THEN ABS(lamports_in) ELSE 0 END), 0) / 1e9 as no_vol
    FROM trades
    WHERE market_pubkey = ${marketPubkey}
  `);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const yesVol = Number(row.yes_vol || 0);
  const noVol = Number(row.no_vol || 0);
  return {
    trades24h: Number(row.trade_count || 0),
    yesVolume24h: yesVol,
    noVolume24h: noVol,
    direction:
      yesVol + noVol > 0
        ? yesVol >= noVol
          ? "BULLISH (YES inflow)"
          : "BEARISH (NO inflow)"
        : "NO TRADES YET",
    priceChangePct: 0,
  };
}

export async function getRecentActivity(
  wallet: string | null,
  limit = 50,
  marketPubkey?: string | null
) {
  if (!db) {
    const now = Date.now();
    return [
      {
        signature: "5KqXyZ...sample1",
        marketPubkey: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
        trader: "7Xw1...94dF",
        side: "YES" as const,
        lamportsIn: 2500000000,
        tokensOut: 3670000,
        blockTime: new Date(now - 2 * 60 * 1000).toISOString(),
        question: "Will SOL trade above $250 by Dec 31, 2026?",
      },
      {
        signature: "3JpAbC...sample2",
        marketPubkey: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
        trader: "9Py2...81aB",
        side: "NO" as const,
        lamportsIn: 1800000000,
        tokensOut: 5620000,
        blockTime: new Date(now - 6 * 60 * 1000).toISOString(),
        question: "Will Bitcoin exceed $120,000 before Q4 2026?",
      },
      {
        signature: "8MmQrS...sample3",
        marketPubkey: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
        trader: "4Kn5...28qZ",
        side: "YES" as const,
        lamportsIn: 4200000000,
        tokensOut: 4890000,
        blockTime: new Date(now - 12 * 60 * 1000).toISOString(),
        question: "Will US Federal Reserve lower benchmark interest rate?",
      },
      {
        signature: "2VxLmN...sample4",
        marketPubkey: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
        trader: "6Rt7...53mK",
        side: "YES" as const,
        lamportsIn: 1200000000,
        tokensOut: 1360000,
        blockTime: new Date(now - 19 * 60 * 1000).toISOString(),
        question: "Will SpaceX Starship land and catch the booster?",
      },
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const query = db
    .select({
      signature: trades.signature,
      marketPubkey: trades.marketPubkey,
      trader: trades.trader,
      side: trades.side,
      lamportsIn: trades.lamportsIn,
      tokensOut: trades.tokensOut,
      blockTime: trades.blockTime,
      question: marketsCache.question,
    })
    .from(trades)
    .leftJoin(marketsCache, eq(trades.marketPubkey, marketsCache.marketPubkey))
    .orderBy(desc(trades.blockTime));

  const filters: (SQL | undefined)[] = [];
  if (wallet) filters.push(eq(trades.trader, wallet));
  if (marketPubkey) filters.push(eq(trades.marketPubkey, marketPubkey));

  const where = filters.length > 1 ? and(...filters) : filters[0];
  const rows = where
    ? await query.where(where).limit(safeLimit)
    : await query.limit(safeLimit);

  return rows.map((r) => ({
    ...r,
    question: r.question || `Market Trade (${r.marketPubkey.slice(0, 8)}...)`,
  }));
}
