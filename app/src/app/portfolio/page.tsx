"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useProgram } from "@/hooks/useProgram";
import { useRealtime } from "@/hooks/useRealtime";
import { subscribeAppActivity } from "@/lib/sync-events";
import { keys } from "@/lib/api/keys";
import { getYesMintPda, getNoMintPda } from "@/lib/pda";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { LabelLux } from "@/components/ui/label-lux";
import { Stat } from "@/components/ui/stat";
import { Rule } from "@/components/ui/rule";
import { cn } from "@/lib/utils";

interface Position {
  marketPubkey: string;
  question: string;
  category: string;
  status: string;
  side: "YES" | "NO";
  shares: number;
  avgPriceSol: number;
  currentPriceSol: number;
  valueSol: number;
  pnlSol: number;
  pnlPercent: number;
  costSol?: number;
}

/**
 * On-chain ATA holdings + LP cost basis for one market — the ground-truth view
 * the portfolio overlays onto the DB-backed positions list.
 *
 * The DB `positions` table is derived from the on-chain `user_position` PDA,
 * which `add_liquidity` does NOT touch: a liquidity deposit mints YES/NO tokens
 * 1:1 with deposited lamports straight into the provider's ATA (no
 * `user_position` row). So DB positions under-count anyone who supplied
 * liquidity (their sellable LP-minted tokens are invisible to the table). The
 * sell section already reads the real ATA; this overlay makes the portfolio
 * show the same true holdings, with cost basis = DB trade cost + LP deposit.
 */
interface OnChainPos {
  yesShares: number;
  noShares: number;
  lpYesCostSol: number;
  lpNoCostSol: number;
  yesPriceSol: number;
  noPriceSol: number;
}

interface LpPosition {
  id: number;
  marketPubkey: string;
  question: string;
  category: string;
  status: string;
  amountSol: number;
  lpTokens: number;
  estFeeEarnedSol: number;
  apy: string;
}

interface PortfolioStats {
  netWorthSol: number;
  pnl24hSol: number;
  pnl24hPct: number;
  winRate: number;
}

export default function PortfolioPage() {
  const { publicKey } = useWallet();
  const { program, connection } = useProgram();
  const { solPrice } = useSolPrice();
  const queryClient = useQueryClient();
  const [positions, setPositions] = useState<Position[]>([]);
  const [lpPositions, setLpPositions] = useState<LpPosition[]>([]);
  const [stats, setStats] = useState<PortfolioStats>({
    netWorthSol: 0,
    pnl24hSol: 0,
    pnl24hPct: 0,
    winRate: 0,
  });
  const [onChainPos, setOnChainPos] = useState<Record<string, OnChainPos>>({});
  const [selectedCategory, setSelectedCategory] = useState("All");

  const walletStr = publicKey?.toBase58() ?? null;

  /**
   * Overlay the user's TRUE on-chain ATA holdings + LP cost basis per market,
   * so the Active Positions table matches the market page's sell section.
   * Runs whenever the DB position list (or the wallet) changes.
   */
  useEffect(() => {
    if (!publicKey) {
      setOnChainPos({});
      return;
    }
    const marketKeys = Array.from(
      new Set([
        ...positions.map((p) => p.marketPubkey),
        ...lpPositions.map((lp) => lp.marketPubkey),
      ])
    );
    if (marketKeys.length === 0) {
      setOnChainPos({});
      return;
    }
    let cancelled = false;

    (async () => {
      const result: Record<string, OnChainPos> = {};
      const chunkSize = 3;
      for (let i = 0; i < marketKeys.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = marketKeys.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (mk) => {
            try {
              const marketPda = new PublicKey(mk);
              const yesMintPda = getYesMintPda(marketPda, program.programId);
              const noMintPda = getNoMintPda(marketPda, program.programId);
              const yesAta = getAssociatedTokenAddressSync(yesMintPda, publicKey, true);
              const noAta = getAssociatedTokenAddressSync(noMintPda, publicKey, true);

              const [yesAcc, noAcc, marketAcc] = await Promise.all([
                connection.getTokenAccountBalance(yesAta).catch(() => null),
                connection.getTokenAccountBalance(noAta).catch(() => null),
                program.account.market.fetch(marketPda).catch(() => null),
              ]);

              const yesShares = yesAcc?.value?.uiAmount ?? 0;
              const noShares = noAcc?.value?.uiAmount ?? 0;

              // Current YES/NO price from the REAL pool reserves
              const yPool = Number(marketAcc?.yesPoolLamports ?? 0);
              const nPool = Number(marketAcc?.noPoolLamports ?? 0);
              const totalPool = yPool + nPool;
              const yesBps = totalPool > 0 ? yPool / totalPool : 0.5;
              const yesPriceSol = yesBps * 0.01;
              const noPriceSol = (1 - yesBps) * 0.01;

              let lpYesCostSol = 0;
              let lpNoCostSol = 0;
              const [lpPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("lp"), marketPda.toBuffer(), publicKey.toBuffer()],
                program.programId
              );
              const lpAccount = await connection
                .getAccountInfo(lpPda)
                .catch(() => null);
              if (lpAccount && lpAccount.data.length >= 104) {
                const data = lpAccount.data;
                const u64 = (off: number) => Number(data.readBigUInt64LE(off));
                lpYesCostSol = u64(80) / 1e9;
                lpNoCostSol = u64(88) / 1e9;
              }

              result[mk] = {
                yesShares,
                noShares,
                lpYesCostSol,
                lpNoCostSol,
                yesPriceSol,
                noPriceSol,
              };
            } catch {
              // Non-critical — the overlay degrades to the DB list.
            }
          })
        );
        if (i + chunkSize < marketKeys.length) {
          await new Promise((res) => setTimeout(res, 50));
        }
      }
      if (!cancelled) setOnChainPos(result);
    })();

    return () => {
      cancelled = true;
    };
    // Re-run when the connected wallet or the DB position set changes.
  }, [publicKey, positions, lpPositions, program, connection]);

  const { isLoading, isError, refetch } = useQuery({
    queryKey: keys.user.positions(walletStr ?? "none"),
    queryFn: async () => {
      // cache: "no-store" — never serve a stale cached positions response
      const r = await fetch(`/api/user/positions?wallet=${walletStr}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data?.ok) {
        if (data.positions) setPositions(data.positions);
        if (data.lpPositions) setLpPositions(data.lpPositions);
        if (data.stats) setStats(data.stats);
      }
      return data;
    },
    enabled: !!walletStr,
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Universal Cross-Page & Cross-Tab Activity Listener
  useEffect(() => {
    const unsub = subscribeAppActivity((detail) => {
      if (!walletStr || !detail?.wallet || detail.wallet === walletStr) {
        void refetch();
        void queryClient.invalidateQueries({
          queryKey: keys.user.positions(walletStr ?? "none"),
        });
      }
    });
    return () => unsub();
  }, [walletStr, refetch, queryClient]);

  // Realtime push: after a confirmed buy/sell/LP the WS server broadcasts fresh
  // positions on the `positions:<wallet>` channel. Listen for it so the
  // portfolio re-reads the DB immediately instead of waiting for the 12s poll.
  const rt = useRealtime(walletStr ? `positions:${walletStr}` : undefined);
  useEffect(() => {
    const unsub = rt.on("positions", () => {
      void refetch();
      void queryClient.invalidateQueries({
        queryKey: keys.user.positions(walletStr ?? "none"),
      });
    });
    return () => unsub?.();
  }, [rt, refetch, queryClient, walletStr]);
  const loading = !!walletStr ? isLoading : false;
  const fetchError = !!walletStr ? isError : false;

  /**
   * Merge the on-chain ATA overlay with the DB position list. For OPEN markets
   * the on-chain ATA is authoritative (it includes LP-minted tokens that
   * `add_liquidity` deposits straight into the ATA), so the table shows the
   * user's true sellable holdings — exactly what the market page's sell
   * section reads. Settled/cancelled positions keep the DB redemption values
   * (their ATA may already be drained by a claim).
   */
  const displayPositions = useMemo(() => {
    if (Object.keys(onChainPos).length === 0) return positions;
    const result: Position[] = [];
    for (const [mk, oc] of Object.entries(onChainPos)) {
      const db = positions.filter((p) => p.marketPubkey === mk);
      const lp = lpPositions.find((l) => l.marketPubkey === mk);
      const dbMeta = db[0];
      const meta: Position | undefined =
        dbMeta ??
        (lp
          ? {
              marketPubkey: mk,
              question: lp.question,
              category: lp.category,
              status: lp.status,
              side: "YES" as const,
              shares: 0,
              avgPriceSol: 0,
              currentPriceSol: 0,
              valueSol: 0,
              pnlSol: 0,
              pnlPercent: 0,
              costSol: 0,
            }
          : undefined);
      if (!meta) continue;

      if (meta.status !== "open" || (oc.yesShares === 0 && oc.noShares === 0)) {
        result.push(...db);
        continue;
      }

      const dbYes = db.find((p) => p.side === "YES");
      const dbNo = db.find((p) => p.side === "NO");

      // ── Subtract LP-minted tokens from ATA balance ─────────────────
      // `add_liquidity` mints YES/NO tokens 1:1 with lamports directly
      // into the user's ATA. These aren't "traded" shares — they're an
      // LP deposit. The raw ATA balance conflates both, so we subtract
      // the LP-deposited token count to isolate ONLY the traded shares.
      //
      // `lpYesCostSol` = yes_deposited (lamports) / 1e9.
      // The token mint has 6 decimals, and add_liquidity mints
      // `yes_lamports` raw token units. uiAmount = rawTokens / 1e6.
      // So LP share count = yes_deposited_lamports / 1e6 = lpYesCostSol * 1e9 / 1e6 = lpYesCostSol * 1e3.
      const lpYesShareCount = oc.lpYesCostSol * 1e3;
      const lpNoShareCount = oc.lpNoCostSol * 1e3;
      const tradedYes = Math.max(0, oc.yesShares - lpYesShareCount);
      const tradedNo = Math.max(0, oc.noShares - lpNoShareCount);

      if (tradedYes > 0) {
        // Cost basis is purely from DB trades (not LP deposits).
        const costSol = dbYes?.costSol ?? 0;
        const valueSol = tradedYes * oc.yesPriceSol;
        const pnlSol = valueSol - costSol;
        result.push({
          ...meta,
          side: "YES",
          shares: tradedYes,
          avgPriceSol: tradedYes > 0 && costSol > 0 ? costSol / tradedYes : 0,
          currentPriceSol: oc.yesPriceSol,
          valueSol,
          pnlSol,
          pnlPercent: costSol > 0 ? (pnlSol / costSol) * 100 : 0,
          costSol,
        });
      }
      if (tradedNo > 0) {
        const costSol = dbNo?.costSol ?? 0;
        const valueSol = tradedNo * oc.noPriceSol;
        const pnlSol = valueSol - costSol;
        result.push({
          ...meta,
          side: "NO",
          shares: tradedNo,
          avgPriceSol: tradedNo > 0 && costSol > 0 ? costSol / tradedNo : 0,
          currentPriceSol: oc.noPriceSol,
          valueSol,
          pnlSol,
          pnlPercent: costSol > 0 ? (pnlSol / costSol) * 100 : 0,
          costSol,
        });
      }
    }
    // Markets with no on-chain overlay (fetch failed) — fall back to DB rows.
    for (const p of positions) {
      if (!onChainPos[p.marketPubkey]) result.push(p);
    }
    return result;
  }, [positions, lpPositions, onChainPos]);

  /** Portfolio stats recomputed from the corrected (on-chain) position list. */
  const displayStats = useMemo(() => {
    const netWorthSol = displayPositions.reduce((s, p) => s + p.valueSol, 0);
    const pnlSol = displayPositions.reduce((s, p) => s + p.pnlSol, 0);
    const spent = displayPositions.reduce((s, p) => s + (p.costSol ?? 0), 0);
    // Win rate only counts SETTLED positions — unrealized P&L on open
    // positions is mark-to-market noise, not a confirmed win.
    const settled = displayPositions.filter((p) => p.status === "settled");
    const wins = settled.filter((p) => p.pnlSol > 0).length;
    return {
      netWorthSol,
      pnl24hSol: pnlSol,
      pnl24hPct: spent > 0 ? (pnlSol / spent) * 100 : 0,
      winRate: settled.length > 0 ? wins / settled.length : 0,
    };
  }, [displayPositions]);

  const categories = useMemo(() => {
    const set = new Set<string>(
      displayPositions
        .map((p) => p.category)
        .concat(lpPositions.map((lp) => lp.category))
    );
    return Array.from(set).filter(Boolean).sort();
  }, [displayPositions, lpPositions]);

  const filteredPositions = useMemo(
    () =>
      selectedCategory === "All"
        ? displayPositions
        : displayPositions.filter((p) => p.category === selectedCategory),
    [displayPositions, selectedCategory]
  );
  const filteredLp = useMemo(
    () =>
      selectedCategory === "All"
        ? lpPositions
        : lpPositions.filter((lp) => lp.category === selectedCategory),
    [lpPositions, selectedCategory]
  );

  const categoryMetrics = useMemo(() => {
    const invested = filteredPositions.reduce(
      (s, p) => s + p.avgPriceSol * p.shares,
      0
    );
    const pnl = filteredPositions.reduce((s, p) => s + p.pnlSol, 0);
    const wins = filteredPositions.filter((p) => p.pnlSol > 0).length;
    const winRate =
      filteredPositions.length > 0
        ? (wins / filteredPositions.length) * 100
        : 0;
    return { invested, pnl, winRate };
  }, [filteredPositions]);

  if (!publicKey) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-6 py-24">
        <div className="max-w-md mx-auto text-center p-8 rounded-2xl border border-hairline bg-cream shadow-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-hairline bg-sheet text-[11px] font-mono uppercase tracking-wider text-ash mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Portfolio Ledger
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-3">
            Connect Your Wallet
          </h1>
          <p className="text-[14px] text-ash mb-8 leading-relaxed">
            Connect a Solana wallet to inspect open positions, track live P&amp;L, and manage liquidity positions.
          </p>
          <div className="flex justify-center">
            <ClientWalletButton />
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-12">
        <div className="space-y-6">
          <div className="w-48 h-6 bg-sheet rounded animate-pulse" />
          <div className="w-full h-32 bg-cream border border-hairline rounded-xl animate-pulse" />
          <div className="w-full h-72 bg-cream border border-hairline rounded-xl animate-pulse" />
        </div>
      </main>
    );
  }

  if (fetchError) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-6 py-24 text-center">
        <div className="max-w-md mx-auto p-8 rounded-2xl border border-no/30 bg-cream">
          <div className="font-mono text-[11px] uppercase tracking-wider text-no mb-2">Data Feed Error</div>
          <p className="text-[14px] text-ash">
            Failed to load portfolio data from the network. Please retry shortly.
          </p>
        </div>
      </main>
    );
  }

  const usdValue =
    solPrice > 0 ? (displayStats.netWorthSol * solPrice).toFixed(2) : null;
  const winRatePct = (displayStats.winRate * 100).toFixed(0);

  return (
    <main className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-8 text-ink">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-ash">
          Positions &amp; Yield Ledger
        </span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-6">
        Portfolio Ledger
      </h1>

      {/* Three large stats on one baseline, separated by vertical hairlines */}
      <section className="border border-hairline bg-cream rounded-xl grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hairline mb-8 overflow-hidden shadow-sm">
        <div className="p-6">
          <Stat
            size="lg"
            label="Net Worth"
            value={`${displayStats.netWorthSol.toFixed(2)} SOL`}
            hint={usdValue ? `$${usdValue} USD` : undefined}
          />
        </div>
        <div className="p-6">
          <Stat
            size="lg"
            label="24h P&L"
            value={`${
              displayStats.pnl24hSol >= 0 ? "+" : ""
            }${displayStats.pnl24hSol.toFixed(2)} SOL`}
            hint={`${
              displayStats.pnl24hPct >= 0 ? "+" : ""
            }${displayStats.pnl24hPct.toFixed(2)}%`}
          />
        </div>
        <div className="p-6">
          <Stat
            size="lg"
            label="Win Rate"
            value={
              displayStats.winRate > 0 ||
              displayPositions.some((p) => p.status === "settled")
                ? `${winRatePct}%`
                : "—"
            }
            hint={`${displayPositions.length} open positions`}
          />
        </div>
      </section>

      {categories.length > 1 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ash-dim">
            Filter:
          </span>
          {["All", ...categories].map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={isSelected}
                className={`cursor-pointer inline-flex items-center h-8 px-3 rounded-lg font-mono text-[11px] transition-colors ${
                  isSelected
                    ? "bg-primary text-white font-medium"
                    : "border border-hairline bg-sheet text-ash hover:text-ink hover:border-hairline-2"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* ACTIVE POSITIONS table */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-3.5 bg-yes rounded-sm" />
          <h2 className="font-mono text-[12px] font-semibold uppercase tracking-wider text-ink">
            Active Positions ({filteredPositions.length})
          </h2>
        </div>
        {filteredPositions.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-hairline bg-cream font-mono text-[13px] text-ash">
            No open positions{selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}. Browse active lines to trade.
          </div>
        ) : (
          <div className="rounded-xl border border-hairline bg-cream overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-hairline bg-sheet/50">
                    <th className="py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-ash">
                      Market
                    </th>
                    <th className="py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-ash">
                      Side
                    </th>
                    <th className="py-3 px-4 text-right font-mono text-[10px] uppercase tracking-wider text-ash">
                      Shares
                    </th>
                    <th className="py-3 px-4 text-right font-mono text-[10px] uppercase tracking-wider text-ash">
                      Avg Price
                    </th>
                    <th className="py-3 px-4 text-right font-mono text-[10px] uppercase tracking-wider text-ash">
                      Current
                    </th>
                    <th className="py-3 px-4 text-right font-mono text-[10px] uppercase tracking-wider text-ash">
                      P&L
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredPositions.map((p, i) => (
                    <tr
                      key={i}
                      className="hover:bg-sheet/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-sans font-medium text-[14px] text-ink max-w-xs truncate">
                        <a href={`/market/${p.marketPubkey}`} className="hover:text-primary transition-colors">
                          {p.question}
                        </a>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[12px]">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.side === "YES"
                              ? "bg-yes-bg border border-yes/30 text-yes"
                              : "bg-no-bg border border-no/30 text-no"
                          }`}
                        >
                          {p.side}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[13px] text-ash">
                        {p.shares.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[13px] text-ash">
                        {p.avgPriceSol.toFixed(3)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[13px] text-ink font-semibold">
                        {p.currentPriceSol.toFixed(3)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono tabular-nums text-[13px] font-bold ${
                          p.pnlSol >= 0 ? "text-yes" : "text-no"
                        }`}
                      >
                        {p.pnlSol >= 0 ? "+" : ""}
                        {p.pnlSol.toFixed(3)}
                        <span className="block text-[10px] font-normal opacity-80">
                          ({p.pnlPercent >= 0 ? "+" : ""}
                          {p.pnlPercent.toFixed(1)}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* LIQUIDITY positions table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-primary rounded-sm" />
            <h2 className="font-mono text-[12px] font-semibold uppercase tracking-wider text-ink">
              Liquidity Positions ({filteredLp.length})
            </h2>
          </div>
          <span className="font-mono text-[10px] text-ash-dim uppercase tracking-wider">
            Fees settled on-chain
          </span>
        </div>
        {filteredLp.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-hairline bg-cream font-mono text-[13px] text-ash">
            No liquidity provided{selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}. Visit any market&apos;s LP tab to deposit seed liquidity and earn trading fee yield.
          </div>
        ) : (
          <div className="rounded-xl border border-hairline bg-cream overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-hairline bg-sheet/50">
                    <th className="py-3 px-4 font-mono text-[10px] uppercase tracking-wider text-ash">
                      Market
                    </th>
                    <th className="py-3 px-4 text-right font-mono text-[10px] uppercase tracking-wider text-ash">
                      Deposited SOL
                    </th>
                    <th className="py-3 px-4 text-right font-mono text-[10px] uppercase tracking-wider text-ash">
                      LP Tokens
                    </th>
                    <th className="py-3 px-4 text-right font-mono text-[10px] uppercase tracking-wider text-ash">
                      Est. Fee Yield
                    </th>
                    <th className="py-3 px-4 text-right font-mono text-[10px] uppercase tracking-wider text-ash">
                      APY
                    </th>
                    <th className="py-3 px-4 text-right font-mono text-[10px] uppercase tracking-wider text-ash">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredLp.map((lp, i) => (
                    <tr
                      key={i}
                      className="hover:bg-sheet/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-sans font-medium text-[14px] text-ink max-w-xs truncate">
                        <a href={`/market/${lp.marketPubkey}`} className="hover:text-primary transition-colors">
                          {lp.question}
                        </a>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[13px] text-ink font-semibold">
                        {lp.amountSol.toFixed(2)} SOL
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[13px] text-primary">
                        {lp.lpTokens.toLocaleString()} LP
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[13px] text-yes font-semibold">
                        {lp.estFeeEarnedSol > 0
                          ? `+${lp.estFeeEarnedSol.toFixed(3)} SOL`
                          : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[13px] text-primary">
                        {lp.apy}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={`/market/${lp.marketPubkey}`}
                          className="inline-flex items-center px-3 py-1 rounded-md border border-hairline bg-sheet hover:border-primary hover:text-primary text-ink font-mono text-[11px] transition-colors"
                        >
                          Manage
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
