"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { Crown, Medal } from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
import { EmptyState, LoadingState } from "@/components/StatePanels";
import { LabelLux } from "@/components/ui/label-lux";
import { Rule } from "@/components/ui/rule";
import { cn } from "@/lib/utils";

interface LeaderboardItem {
  rank: number;
  wallet: string;
  username: string;
  avatarUrl: string;
  bio: string;
  totalWagered: number;
  totalProfit: number;
  winRate: number | null;
  winRateBps: number | null;
  marketsTraded: number;
  tradeCount: number;
  wins: number;
  losses: number;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

const RANK_META: Record<
  number,
  { text: string; border: string; icon: React.ReactNode; label: string }
> = {
  1: {
    text: "text-cyan",
    border: "border-cyan/40",
    icon: <Crown className="w-4 h-4 text-cyan" aria-hidden />,
    label: "First place",
  },
  2: {
    text: "text-ink",
    border: "border-hairline-2",
    icon: <Medal className="w-4 h-4 text-ink" aria-hidden />,
    label: "Second place",
  },
  3: {
    text: "text-magenta",
    border: "border-magenta/40",
    icon: <Medal className="w-4 h-4 text-magenta" aria-hidden />,
    label: "Third place",
  },
};

function LeaderboardPage() {
  const wallet = useWallet();
  const [traders, setTraders] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"volume" | "profit" | "winRate">(
    "volume"
  );

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/leaderboard?sortBy=${sortBy}`);
      if (!res.ok) throw new Error("Failed to load leaderboard");
      const data = await res.json();
      if (data.ok && Array.isArray(data.leaderboard)) {
        setTraders(data.leaderboard);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const realtimeFetch = useCallback(() => {
    fetch(`/api/leaderboard?sortBy=${sortBy}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && Array.isArray(data.leaderboard))
          setTraders(data.leaderboard);
      })
      .catch(() => {});
  }, [sortBy]);

  const rt = useRealtime("leaderboard");
  useEffect(() => {
    const unsub = rt.on("update", () => realtimeFetch());
    return () => unsub?.();
  }, [rt, realtimeFetch]);

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy]);

  const myAddress = wallet.publicKey?.toBase58();
  const myRankIndex = myAddress
    ? traders.findIndex((t) => t.wallet === myAddress)
    : -1;
  const myStats = myRankIndex >= 0 ? traders[myRankIndex] : null;

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-10">
      {/* Masthead */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 rise">
        <div>
          <LabelLux className="mb-1">Leaderboard</LabelLux>
          <h1 className="font-display text-[34px] font-extrabold text-ink tracking-tight">
            The Ranks
          </h1>
          <p className="mt-1 font-mono text-[10px] text-ash-dim uppercase tracking-wider">
            Live from on-chain user stats
          </p>
        </div>

        {/* Sort pills */}
        <div className="flex items-center gap-1 p-1 rounded-[8px] self-start overflow-x-auto no-scrollbar bg-cream border border-hairline">
          {[
            { key: "volume", label: "Volume" },
            { key: "profit", label: "Profit" },
            { key: "winRate", label: "Win Rate" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key as any)}
              aria-pressed={sortBy === opt.key}
              className={`px-3 h-8 rounded-[4px] font-mono text-[11px] font-medium tracking-wide transition-colors cursor-pointer snap ${
                sortBy === opt.key
                  ? "bg-ink-fill text-white"
                  : "text-ash hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Rule className="mb-8" />

      {/* Your rank banner */}
      {myStats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-cream border border-hairline rounded-[8px] shadow-sm border-t-4 border-t-cyan p-5 mb-8 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ash-dim">
              Your Rank
            </span>
            <span className="font-display text-[32px] font-bold text-cyan leading-none">
              #{myRankIndex + 1}
            </span>
            <span className="num font-mono text-[13px] text-ink">
              {shortAddr(myStats.wallet)}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-8 num font-mono text-[12px] tnum">
            <span className="text-ash-dim">
              Volume{" "}
              <span className="text-ink font-bold">
                {myStats.totalWagered.toFixed(2)} ◎
              </span>
            </span>
            <span className="text-ash-dim">
              Win Rate{" "}
              <span className="text-magenta font-bold">
                {myStats.winRate !== null
                  ? `${Math.round(myStats.winRate)}%`
                  : "—"}
              </span>
            </span>
            <span className="text-ash-dim">
              PnL{" "}
              <span
                className={`font-bold ${
                  myStats.totalProfit >= 0 ? "text-grass" : "text-magenta"
                }`}
              >
                {myStats.totalProfit >= 0 ? "+" : ""}
                {myStats.totalProfit.toFixed(2)} ◎
              </span>
            </span>
          </div>
        </motion.div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingState title="Loading leaderboard..." />
      ) : error ? (
        <EmptyState title="Error Loading Leaderboard" description={error} />
      ) : traders.length === 0 ? (
        <EmptyState
          title="No Leaderboard Data"
          description="Be the first to trade and take the crown!"
        />
      ) : (
        <>
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-12 items-center gap-4 px-4 py-2 mb-2 border border-hairline border-b-0 rounded-t bg-sheet">
            <span className="col-span-1 label-lux">#</span>
            <span className="col-span-5 label-lux">Trader</span>
            <span className="col-span-2 label-lux text-right">Volume</span>
            <span className="col-span-2 label-lux text-right">PnL</span>
            <span className="col-span-2 label-lux text-right">
              Win / Markets
            </span>
          </div>

          {/* Desktop rows */}
          <div className="hidden md:block board">
            {traders.map((t, idx) => {
              const isMe = myAddress === t.wallet;
              const meta = RANK_META[idx + 1];
              const pnl = t.totalProfit;
              return (
                <motion.div
                  key={t.wallet}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: Math.min(idx * 0.03, 0.35),
                  }}
                  className={cn(
                    "board-row group w-full grid grid-cols-12 items-center gap-4 px-4 py-4 border border-hairline bg-cream",
                    isMe ? "!border-cyan/50 bg-cyan/[0.04]" : "",
                    idx < 3 ? "bg-sheet" : ""
                  )}
                >
                  <span
                    className="col-span-1 flex items-center gap-2"
                    title={meta?.label}
                  >
                    {meta?.icon}
                    <span
                      className={cn(
                        "font-display font-bold text-[26px] leading-none tnum group-hover:text-magenta transition-colors",
                        meta?.text ?? "text-ash-dim"
                      )}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="sr-only">{meta?.label}</span>
                  </span>
                  <span className="col-span-5 min-w-0 flex items-center gap-3">
                    {t.avatarUrl ? (
                      <Image
                        src={t.avatarUrl}
                        alt=""
                        width={30}
                        height={30}
                        className="w-[30px] h-[30px] rounded-full border border-hairline shrink-0"
                      />
                    ) : (
                      <span
                        className="w-[30px] h-[30px] rounded-full border border-hairline bg-sheet flex items-center justify-center font-mono text-[11px] text-ash shrink-0"
                        aria-hidden
                      >
                        {(t.username || t.wallet)[0].toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block num font-mono text-[13px] text-ink truncate group-hover:text-magenta transition-colors">
                        {t.username || shortAddr(t.wallet)}
                      </span>
                      {isMe && (
                        <span className="label-lux mt-0.5 block !text-magenta">
                          You
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="col-span-2 num font-mono tnum text-[13px] text-ash text-right">
                    {t.totalWagered.toFixed(2)} ◎
                  </span>
                  <span
                    className={cn(
                      "col-span-2 num font-mono tnum text-[14px] font-bold text-right",
                      pnl > 0
                        ? "text-grass"
                        : pnl < 0
                        ? "text-magenta"
                        : "text-ash"
                    )}
                  >
                    {pnl > 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2)}
                  </span>
                  <span className="col-span-2 hidden lg:flex flex-col items-end num font-mono text-[11px] tnum text-ash-dim">
                    <span
                      className={
                        t.winRate !== null && t.winRate >= 50
                          ? "text-grass"
                          : ""
                      }
                    >
                      {t.winRate !== null ? `${Math.round(t.winRate)}%` : "—"}
                    </span>
                    <span>{t.marketsTraded} markets</span>
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {traders.map((t, idx) => {
              const isMe = myAddress === t.wallet;
              const meta = RANK_META[idx + 1];
              const pnl = t.totalProfit;
              return (
                <motion.div
                  key={t.wallet}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(idx * 0.03, 0.35),
                  }}
                  className={cn(
                    "bg-cream border border-hairline rounded-[8px] shadow-sm p-4",
                    idx < 3 ? "border-hairline-2" : "",
                    isMe ? "!border-cyan/50 bg-cyan/[0.04]" : ""
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex items-center gap-1.5"
                      title={meta?.label}
                    >
                      {meta?.icon}
                      <span
                        className={cn(
                          "font-display font-bold text-[22px] leading-none tnum",
                          meta?.text ?? "text-ash-dim"
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className="sr-only">{meta?.label}</span>
                    </span>
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                      {t.avatarUrl ? (
                        <Image
                          src={t.avatarUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="w-7 h-7 rounded-full border border-hairline shrink-0"
                        />
                      ) : (
                        <span
                          className="w-7 h-7 rounded-full border border-hairline bg-sheet flex items-center justify-center font-mono text-[10px] text-ash shrink-0"
                          aria-hidden
                        >
                          {(t.username || t.wallet)[0].toUpperCase()}
                        </span>
                      )}
                      <span className="num font-mono text-[13px] text-ink truncate">
                        {t.username || shortAddr(t.wallet)}
                        {isMe && (
                          <em className="not-italic text-[10px] text-magenta">
                            {" "}
                            · You
                          </em>
                        )}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "num font-mono text-[14px] font-bold",
                        pnl > 0
                          ? "text-grass"
                          : pnl < 0
                          ? "text-magenta"
                          : "text-ash"
                      )}
                    >
                      {pnl > 0 ? `+${pnl.toFixed(1)}` : pnl.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2.5 num font-mono text-[10px] text-ash-dim">
                    <span>Vol {t.totalWagered.toFixed(1)} ◎</span>
                    <span>
                      Win{" "}
                      {t.winRate !== null ? `${Math.round(t.winRate)}%` : "—"}
                    </span>
                    <span>{t.marketsTraded} markets</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Timeframe note */}
      <p className="mt-8 text-center font-mono text-[10px] text-ash-dim">
        Rankings reflect lifetime on-chain stats.
      </p>
    </main>
  );
}

export default LeaderboardPage;
