import { useEffect, useState, useCallback, useRef } from "react";
import { useProgram } from "./useProgram";
import { PublicKey } from "@solana/web3.js";
import type { MarketCacheEntry } from "@/lib/db/markets-store";
import { useRealtime } from "./useRealtime";
import { subscribeAppActivity } from "@/lib/sync-events";
import { getMarketPda } from "@/lib/pda";
import * as anchor from "@coral-xyz/anchor";
import { ENV } from "@/lib/env";

export interface MarketAccount {
  publicKey: PublicKey;
  account: {
    marketId: number;
    authority: PublicKey;
    question: string;
    description: string;
    category: number;
    oracleFeedId: number[];
    targetPrice: number;
    targetExpo: number;
    comparison: number;
    endTs: number;
    resolveTs: number;
    status: number;
    winningOutcome: number;
    yesMint: PublicKey;
    noMint: PublicKey;
    yesPoolLamports: number;
    noPoolLamports: number;
    yesSupply: number;
    noSupply: number;
    totalPayoutPool: number;
    feeCollected: number;
    feeWithdrawn: boolean;
    totalClaimed: number;
    settledPrice: number;
    settledExpo: number;
    settledAt: number;
    sharePriceLamports: number;
    bump: number;
    treasuryBump: number;
  };
  // DB enrichment data
  _dbVolume24h?: number;
  _dbTotalVolume?: number;
  _dbTraders?: number;
  _dbLiquidity?: number;
  _dbViewCount?: number;
  _dbCreatedAt?: string;
}

const CATEGORY_MAP: Record<string, number> = {
  Crypto: 0,
  Sports: 1,
  Politics: 2,
  Tech: 3,
  Other: 4,
};
const STATUS_MAP: Record<string, number> = {
  open: 0,
  Open: 0,
  settled: 1,
  Settled: 1,
  cancelled: 2,
  Cancelled: 2,
};

/** Convert a DB cached-market row (the shape returned by /api/markets/cached) into a MarketAccount. */
export function dbRowToMarketAccount(
  m: MarketCacheEntry & {
    volume24h?: number;
    traders?: number;
    liquidity?: number;
    viewCount?: number;
  },
  programId: PublicKey
): MarketAccount {
  let pubkey: PublicKey;
  try {
    if (m.marketPubkey && m.marketPubkey.length >= 32) {
      pubkey = new PublicKey(m.marketPubkey);
    } else {
      throw new Error("invalid pubkey");
    }
  } catch {
    // DB market without a usable on-chain address — derive a deterministic
    // PDA from marketId so watchlist/navigation keys stay stable.
    pubkey = getMarketPda(new anchor.BN(Number(m.marketId || 0)), programId);
  }
  return {
    publicKey: pubkey,
    account: {
      marketId: Number(m.marketId || 0),
      authority: PublicKey.default,
      question: m.question,
      description: m.description || "",
      category: CATEGORY_MAP[m.category] ?? 4,
      oracleFeedId: [],
      targetPrice: 0,
      targetExpo: 0,
      comparison: 0,
      endTs: Math.floor(new Date(m.endTs).getTime() / 1000),
      resolveTs: Math.floor(new Date(m.resolveTs).getTime() / 1000),
      status: STATUS_MAP[m.status] ?? 0,
      winningOutcome:
        m.winningOutcome === "yes" ? 1 : m.winningOutcome === "no" ? 2 : 0,
      yesMint: PublicKey.default,
      noMint: PublicKey.default,
      // Real pool/supply snapshots from markets_cache (written by the
      // indexer + trade sync). Never fabricate from liquidity.
      yesPoolLamports: Number((m as any).yesPoolLamports ?? 0),
      noPoolLamports: Number((m as any).noPoolLamports ?? 0),
      yesSupply: Number((m as any).yesSupply ?? 0),
      noSupply: Number((m as any).noSupply ?? 0),
      totalPayoutPool: 0,
      feeCollected: 0,
      feeWithdrawn: false,
      totalClaimed: 0,
      settledPrice: 0,
      settledExpo: 0,
      settledAt: 0,
      sharePriceLamports: 0,
      bump: 0,
      treasuryBump: 0,
    },
    // Pass DB enrichment data through
    _dbVolume24h: m.volume24h ?? 0,
    _dbTotalVolume: Number((m as any).totalVolume ?? 0),
    _dbTraders: m.traders ?? 0,
    _dbLiquidity: Number((m as any).totalVolume || (m as any).totalPool || m.liquidity || 0),
    _dbViewCount: m.viewCount ?? 0,
    _dbCreatedAt: m.createdAt
      ? m.createdAt instanceof Date
        ? m.createdAt.toISOString()
        : String(m.createdAt)
      : undefined,
  };
}

/** Decode an on-chain Anchor Market account into a MarketAccount. */
function onChainToMarketAccount(item: any): MarketAccount {
  const acct = item.account;
  const statusObj = acct.status;
  const statusNum =
    statusObj?.open !== undefined
      ? 0
      : statusObj?.settled !== undefined
      ? 1
      : statusObj?.cancelled !== undefined
      ? 2
      : 0;
  const outcomeObj = acct.winningOutcome;
  const outcomeNum =
    outcomeObj?.unset !== undefined
      ? 0
      : outcomeObj?.yes !== undefined
      ? 1
      : outcomeObj?.no !== undefined
      ? 2
      : 0;
  return {
    publicKey: item.publicKey as PublicKey,
    account: {
      marketId: acct.marketId.toNumber(),
      authority: acct.authority as PublicKey,
      question: acct.question,
      description: acct.description,
      category: acct.category,
      oracleFeedId: acct.oracleFeedId,
      targetPrice: acct.targetPrice.toNumber(),
      targetExpo: acct.targetExpo,
      comparison: acct.comparison,
      endTs: acct.endTs.toNumber(),
      resolveTs: acct.resolveTs.toNumber(),
      status: statusNum,
      winningOutcome: outcomeNum,
      yesMint: acct.yesMint as PublicKey,
      noMint: acct.noMint as PublicKey,
      yesPoolLamports: acct.yesPoolLamports.toNumber(),
      noPoolLamports: acct.noPoolLamports.toNumber(),
      yesSupply: acct.yesSupply.toNumber(),
      noSupply: acct.noSupply.toNumber(),
      totalPayoutPool: acct.totalPayoutPool.toNumber(),
      feeCollected: acct.feeCollected.toNumber(),
      feeWithdrawn: acct.feeWithdrawn,
      totalClaimed: acct.totalClaimed?.toNumber() ?? 0,
      settledPrice: acct.settledPrice?.toNumber() ?? 0,
      settledExpo: acct.settledExpo ?? 0,
      settledAt: acct.settledAt?.toNumber() ?? 0,
      sharePriceLamports: acct.sharePriceLamports.toNumber(),
      bump: acct.bump,
      treasuryBump: acct.treasuryBump,
    },
  };
}

export function useMarkets(
  pollIntervalMs = 10_000,
  initialRows?: MarketCacheEntry[],
  opts?: { status?: "open" | "all" }
) {
  const { program } = useProgram();
  const includeClosed = opts?.status === "all";

  // Seed state from server-prefetched rows via a LAZY initializer so the SSR
  // HTML renders the real market list (no loading skeleton flash). ENV.programId
  // is always available (unlike the wallet-bound `program`, which may be
  // undefined on first render), and the conversion is pure/deterministic, so
  // the server and client render identically. The mount effect below still
  // calls fetchMarkets() to apply on-chain enrichment and keep data fresh.
  const [markets, setMarkets] = useState<MarketAccount[]>(() =>
    initialRows && initialRows.length > 0
      ? initialRows
          .map((m) => dbRowToMarketAccount(m as any, ENV.programId))
          .sort((a, b) => b.account.marketId - a.account.marketId)
      : []
  );
  const [loading, setLoading] = useState<boolean>(!initialRows?.length);
  const [error, setError] = useState<string | null>(null);

  // DB is the primary data source
  const fetchFromDb = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(
        `/api/markets/cached?limit=200${includeClosed ? "&status=all" : ""}`
      );
      const data = await res.json();
      if (data.ok && data.markets?.length > 0) {
        const converted = data.markets.map((m: any) =>
          dbRowToMarketAccount(m, program.programId)
        );
        setMarkets((prev) => {
          const map = new Map<string, MarketAccount>();
          // Keep existing markets so SSR/initialRows are never dropped
          for (const m of prev) {
            map.set(m.publicKey.toBase58(), m);
          }
          // Overwrite/enrich with fresh DB data
          for (const m of converted) {
            map.set(m.publicKey.toBase58(), m);
          }
          return Array.from(map.values()).sort(
            (a: MarketAccount, b: MarketAccount) =>
              b.account.marketId - a.account.marketId
          );
        });
        setError(null);
        return true;
      }
    } catch (e) {
      console.warn("DB cached markets fetch failed:", e);
    }
    return false;
  }, [program, includeClosed]);

  const fetchMarkets = useCallback(async () => {
    // Always try DB first (primary source of truth)
    const dbSuccess = await fetchFromDb();

    if (dbSuccess) {
      setLoading(false);
      return;
    }

    // DB returned nothing — try on-chain as fallback
    if (program) {
      try {
        const all = await program.account.market.all();
        if (all.length > 0) {
          const parsed = all.map(onChainToMarketAccount);
          const visible = includeClosed
            ? parsed
            : parsed.filter((m) => m.account.status === 0);
          if (visible.length > 0) {
            const sorted = visible.sort(
              (a, b) => b.account.marketId - a.account.marketId
            );
            setMarkets(sorted);
            setError(null);
          }
        } else {
          setError("No markets found");
        }
      } catch {
        setError(
          "Markets unavailable — database and blockchain both unreachable"
        );
      }
    } else {
      setError("No data source available");
    }

    setLoading(false);
  }, [program, fetchFromDb, includeClosed]);

  const rt = useRealtime("markets");
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined
  );

  useEffect(() => {
    // State is already seeded from server-prefetched rows (lazy initializer).
    // fetchMarkets() applies on-chain enrichment + freshness in the background;
    // with the /api/markets TTL cache this call is cheap, so no visible delay.
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    if (rt.connected) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    } else if (!pollingRef.current) {
      pollingRef.current = setInterval(fetchMarkets, pollIntervalMs);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMarkets, pollIntervalMs, rt.connected]);

  useEffect(() => {
    const unsub = rt.on("markets", () => fetchMarkets());
    const unsubUpdate = rt.on("update", () => fetchMarkets());
    return () => {
      unsub?.();
      unsubUpdate?.();
    };
  }, [fetchMarkets, rt]);

  // Universal Cross-Page & Cross-Tab Activity Listener
  useEffect(() => {
    const unsub = subscribeAppActivity(() => {
      fetchMarkets();
    });
    return () => unsub();
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}
