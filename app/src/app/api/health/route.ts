export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { Connection } from "@solana/web3.js";
import { getDb } from "@/lib/db/client";
import { getCursor } from "@/lib/indexer/reducer";
import {
  marketsCache,
  marketOutcomes,
  trades,
  positions,
  userStats,
} from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { ENV } from "@/lib/env";

const RPC_URL = ENV.serverRpcUrl;

export const GET = apiHandler(async (req: NextRequest) => {
  const db = getDb();
  if (!db) {
    return ok({
      ok: true,
      status: "healthy (mock mode)",
      db: {
        connected: false,
        mock: true,
        tables: {
          marketsCache: 8,
          marketOutcomes: 16,
          trades: 42,
          positions: 12,
          userStats: 24,
        },
      },
      indexer: {
        currentSlot: 0,
        cursorSlot: 0,
        slotLag: 0,
        isLagging: false,
        statusBadge: "GREEN",
      },
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const [mCount, oCount, tCount, pCount, uCount, procCheck] =
      await Promise.all([
        db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache),
        db.select({ count: sql<number>`COUNT(*)::int` }).from(marketOutcomes),
        db.select({ count: sql<number>`COUNT(*)::int` }).from(trades),
        db.select({ count: sql<number>`COUNT(*)::int` }).from(positions),
        db.select({ count: sql<number>`COUNT(*)::int` }).from(userStats),
        db.execute(
          sql`SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'recompute_user_stats') as fn_exists`
        ),
      ]);

    // Check indexer lag
    let currentSlot = 0;
    let cursorSlot = 0;
    let slotLag = 0;
    try {
      const connection = new Connection(RPC_URL, "confirmed");
      const rpcPromise = (async () => {
        const slot = await connection.getSlot();
        const cursor = await getCursor();
        return { slot, cursor };
      })();
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("RPC timeout")), 2500)
      );
      const res = await Promise.race([rpcPromise, timeoutPromise]);
      if (res) {
        currentSlot = res.slot;
        cursorSlot = res.cursor?.lastSlot ?? currentSlot;
        slotLag = Math.max(0, currentSlot - cursorSlot);
      }
    } catch {
      // RPC transient error or timeout fallback
    }

    const recomputeFnInstalled = Boolean(
      (procCheck.rows[0] as Record<string, unknown> | undefined)?.fn_exists
    );
    const isLagging = slotLag > 150;

    return ok({
      ok: true,
      status: isLagging ? "degraded" : "healthy",
      db: {
        connected: true,
        recomputeUserStatsInstalled: recomputeFnInstalled,
        tables: {
          marketsCache: mCount[0]?.count ?? 0,
          marketOutcomes: oCount[0]?.count ?? 0,
          trades: tCount[0]?.count ?? 0,
          positions: pCount[0]?.count ?? 0,
          userStats: uCount[0]?.count ?? 0,
        },
      },
      indexer: {
        currentSlot,
        cursorSlot,
        slotLag,
        isLagging,
        statusBadge: isLagging ? "RED (Lag > 150 slots)" : "GREEN",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return ok({
      ok: true,
      status: "degraded",
      db: {
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      },
      timestamp: new Date().toISOString(),
    });
  }
});
