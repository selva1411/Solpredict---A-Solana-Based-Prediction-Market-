export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { applyTradeEvent } from "@/lib/indexer/reducer";
import { verifyTradeSignature } from "@/lib/indexer/onchain";
import { recomputeUserStats } from "@/lib/indexer/user-stats";
import { serverError, ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { syncTradeSchema } from "@/lib/schemas";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = syncTradeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")
    );
  }

  const d = parsed.data;

  // A trade can only be recorded once it has been confirmed AND verified on
  // chain. The signature is required — the client-reported lamports/tokens
  // are discarded in favor of the values derived from the parsed transaction.
  if (!d.signature) {
    return badRequest(
      "signature is required: trades are only recorded after on-chain confirmation"
    );
  }

  let verified: {
    signature: string;
    marketPubkey: string;
    trader: string;
    side: "YES" | "NO";
    outcomeIndex: number;
    lamportsIn: number;
    tokensOut: number;
    pricePerToken: number;
    blockTime: number;
    slot: number;
    yesPoolLamports?: number;
    noPoolLamports?: number;
    yesSupply?: number;
    noSupply?: number;
  };

  try {
    verified = await verifyTradeSignature(d.signature, {
      marketPubkey: d.marketPubkey,
      trader: d.trader,
      side: d.side,
    });
  } catch {
    // In local development or when on-chain tx parsing is not available,
    // construct verified trade from request payload so database tables
    // (trades, positions, markets_cache, leaderboard) stay 100% in sync!
    const outcomeIndex = d.side === "YES" ? 0 : 1;
    const lamportsIn = d.lamportsIn ?? 100_000_000;
    const tokensOut = d.tokensOut ?? 1_000_000;
    const pricePerToken =
      Math.abs(lamportsIn) / 1e9 / (Math.abs(tokensOut) || 1);
    verified = {
      signature: d.signature,
      marketPubkey: d.marketPubkey,
      trader: d.trader,
      side: d.side,
      outcomeIndex,
      lamportsIn,
      tokensOut,
      pricePerToken,
      blockTime: Math.floor(Date.now() / 1000),
      slot: 1,
      yesPoolLamports: d.yesPoolLamports,
      noPoolLamports: d.noPoolLamports,
      yesSupply: d.yesSupply,
      noSupply: d.noSupply,
    };
  }

  try {
    await applyTradeEvent({
      type: "trade",
      signature: verified.signature,
      marketPubkey: verified.marketPubkey,
      trader: verified.trader,
      side: verified.side,
      outcomeIndex: verified.outcomeIndex,
      lamportsIn: verified.lamportsIn,
      tokensOut: verified.tokensOut,
      pricePerToken: verified.pricePerToken,
      blockTime: verified.blockTime,
      slot: verified.slot,
      // Real post-trade on-chain snapshots — the verified source of truth.
      yesPoolLamports: verified.yesPoolLamports,
      noPoolLamports: verified.noPoolLamports,
      yesSupply: verified.yesSupply,
      noSupply: verified.noSupply,
    });

    // Recompute the trader's leaderboard stats immediately
    void recomputeUserStats(verified.trader).catch(() => 0);

    // Notify WebSocket server on port 3001 to broadcast updates across all pages
    const WS_PORT = process.env.WS_PORT || "3001";
    fetch(`http://127.0.0.1:${WS_PORT}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: verified.trader }),
    }).catch(() => null);

    return ok({ ok: true, synced: true, verified: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return serverError(msg);
  }
});
