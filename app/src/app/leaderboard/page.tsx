"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { Crown, Medal } from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
import { subscribeAppActivity } from "@/lib/sync-events";
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
    text: "text-[#5B8FA8]",
    border: "border-[#5B8FA8]/40",
    icon: <Crown className="w-4 h-4 text-[#5B8FA8]" aria-hidden />,
    label: "First place",
  },
  2: {
    text: "text-[#9DA7B3]",
    border: "border-[#9DA7B3]/40",
    icon: <Medal className="w-4 h-4 text-[#9DA7B3]" aria-hidden />,
    label: "Second place",
  },
  3: {
    text: "text-[#606B7B]",
    border: "border-[#606B7B]/40",
    icon: <Medal className="w-4 h-4 text-[#606B7B]" aria-hidden />,
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
    const unsubLb = rt.on("leaderboard", () => realtimeFetch());
    return () => {
      unsub?.();
      unsubLb?.();
    };
  }, [rt, realtimeFetch]);

  // Universal Cross-Page & Cross-Tab Activity Listener
  useEffect(() => {
    const unsub = subscribeAppActivity(() => {
      realtimeFetch();
    });
    return () => unsub();
  }, [realtimeFetch]);

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy]);

  const myAddress = wallet.publicKey?.toBase58();
  const myRankIndex = myAddress
    ? traders.findIndex((t) => t.wallet === myAddress)
    : -1;
  const myStats = myRankIndex >= 0 ? traders[myRankIndex] : null;

  return (
    <main className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-8 text-[#181A1C] dark:text-[#EAE8E3]">
      {/* Masthead */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 border-b border-[#E2DFD7] dark:border-[#2A2F36] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1F3A52] dark:bg-[#7A9BB5]" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-semibold">
              Global Rankings &amp; Alpha
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181A1C] dark:text-[#EAE8E3]">
            Exchange Leaderboard
          </h1>
        </div>

        {/* Sort pills */}
        <div className="flex items-center gap-1 p-0.5 rounded-[3px] self-start overflow-x-auto no-scrollbar bg-[#F1EFEA] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36]">
          {[
            { key: "volume", label: "Volume" },
            { key: "profit", label: "Profit" },
            { key: "winRate", label: "Win Rate" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key as any)}
              aria-pressed={sortBy === opt.key}
              className={`px-3 h-7 rounded-[2px] font-sans text-[11px] font-semibold transition-colors cursor-pointer ${
                sortBy === opt.key
                  ? "bg-white dark:bg-[#21252A] text-[#181A1C] dark:text-[#EAE8E3] shadow-xs"
                  : "text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Your rank banner */}
      {myStats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#FFFFFF] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] p-5 mb-6 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-semibold">
              Your Rank
            </span>
            <span className="font-mono text-[28px] font-bold text-[#1F3A52] dark:text-[#7A9BB5] leading-none">
              #{myRankIndex + 1}
            </span>
            <span className="font-mono text-[13px] text-[#181A1C] dark:text-[#EAE8E3] font-semibold">
              {shortAddr(myStats.wallet)}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-8 font-mono text-[12px] tabular-nums">
            <span className="text-[#7F8892] dark:text-[#68707B]">
              Volume{" "}
              <span className="text-[#181A1C] dark:text-[#EAE8E3] font-semibold">
                {myStats.totalWagered.toFixed(2)} SOL
              </span>
            </span>
            <span className="text-[#7F8892] dark:text-[#68707B]">
              Win Rate{" "}
              <span className="text-[#1D7C59] dark:text-[#52B788] font-semibold">
                {myStats.winRate !== null
                  ? `${Math.round(myStats.winRate)}%`
                  : "—"}
              </span>
            </span>
            <span className="text-[#7F8892] dark:text-[#68707B]">
              PnL{" "}
              <span
                className={`font-semibold ${
                  myStats.totalProfit >= 0 ? "text-[#1D7C59] dark:text-[#52B788]" : "text-[#B43C34] dark:text-[#E57373]"
                }`}
              >
                {myStats.totalProfit >= 0 ? "+" : ""}
                {myStats.totalProfit.toFixed(2)} SOL
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
          {/* Desktop board */}
          <div className="hidden md:block border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] overflow-hidden bg-[#FFFFFF] dark:bg-[#1A1D21]">
            <div className="grid grid-cols-12 items-center gap-4 px-5 py-3 border-b border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F8F7F4] dark:bg-[#16181C] font-mono text-[10px] uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-semibold">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Trader</span>
              <span className="col-span-2 text-right">Volume</span>
              <span className="col-span-2 text-right">PnL</span>
              <span className="col-span-2 text-right">Win / Markets</span>
            </div>

            <div className="divide-y divide-[#E2DFD7] dark:divide-[#2A2F36]">
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
                      duration: 0.2,
                      delay: Math.min(idx * 0.02, 0.2),
                    }}
                    className={cn(
                      "group w-full grid grid-cols-12 items-center gap-4 px-5 py-3.5 hover:bg-[#F8F7F4] dark:hover:bg-[#21252A] transition-colors",
                      isMe ? "bg-[#F1EFEA] dark:bg-[#21252A] border-l-2 border-[#1F3A52] dark:border-[#7A9BB5]" : ""
                    )}
                  >
                    <span
                      className="col-span-1 flex items-center gap-2"
                      title={meta?.label}
                    >
                      {meta?.icon}
                      <span
                        className={cn(
                          "font-mono font-bold text-[18px] leading-none tabular-nums",
                          meta?.text ?? "text-[#7F8892] dark:text-[#68707B]"
                        )}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    </span>
                    <span className="col-span-5 min-w-0 flex items-center gap-3">
                      {t.avatarUrl ? (
                        <Image
                          src={t.avatarUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="w-7 h-7 rounded-full border border-[#E2DFD7] dark:border-[#2A2F36] shrink-0"
                        />
                      ) : (
                        <span
                          className="w-7 h-7 rounded-full border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#21252A] flex items-center justify-center font-mono text-[11px] text-[#555D65] dark:text-[#9AA1AA] shrink-0 font-semibold"
                          aria-hidden
                        >
                          {(t.username || t.wallet)[0].toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block font-sans text-[13px] font-semibold text-[#181A1C] dark:text-[#EAE8E3] truncate group-hover:text-[#1F3A52] dark:group-hover:text-[#7A9BB5] transition-colors">
                          {t.username || shortAddr(t.wallet)}
                        </span>
                        {isMe && (
                          <span className="font-mono text-[10px] text-[#1F3A52] dark:text-[#7A9BB5] block font-semibold">
                            You
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="col-span-2 font-mono tabular-nums text-[13px] text-[#555D65] dark:text-[#9AA1AA] text-right">
                      {t.totalWagered.toFixed(2)} SOL
                    </span>
                    <span
                      className={cn(
                        "col-span-2 font-mono tabular-nums text-[13px] font-semibold text-right",
                        pnl > 0
                          ? "text-[#1D7C59] dark:text-[#52B788]"
                          : pnl < 0
                          ? "text-[#B43C34] dark:text-[#E57373]"
                          : "text-[#7F8892] dark:text-[#68707B]"
                      )}
                    >
                      {pnl > 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2)} SOL
                    </span>
                    <span className="col-span-2 hidden lg:flex flex-col items-end font-mono text-[11px] tabular-nums text-[#7F8892] dark:text-[#68707B]">
                      <span
                        className={
                          t.winRate !== null && t.winRate >= 50
                            ? "text-[#1D7C59] dark:text-[#52B788] font-semibold"
                            : "text-[#7F8892] dark:text-[#68707B]"
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
                    "bg-[#FFFFFF] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] p-4",
                    isMe ? "border-[#1F3A52] dark:border-[#7A9BB5]" : ""
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      {meta?.icon}
                      <span
                        className={cn(
                          "font-mono font-bold text-[18px] leading-none tabular-nums",
                          meta?.text ?? "text-[#7F8892] dark:text-[#68707B]"
                        )}
                      >
                        #{idx + 1}
                      </span>
                    </span>
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-sans text-[13px] font-semibold text-[#181A1C] dark:text-[#EAE8E3] truncate">
                        {t.username || shortAddr(t.wallet)}
                        {isMe && (
                          <em className="not-italic font-mono text-[10px] text-[#1F3A52] dark:text-[#7A9BB5] ml-1 font-semibold">
                            · You
                          </em>
                        )}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[13px] font-semibold tabular-nums",
                        pnl > 0
                          ? "text-[#1D7C59] dark:text-[#52B788]"
                          : pnl < 0
                          ? "text-[#B43C34] dark:text-[#E57373]"
                          : "text-[#7F8892] dark:text-[#68707B]"
                      )}
                    >
                      {pnl > 0 ? `+${pnl.toFixed(1)}` : pnl.toFixed(1)} SOL
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#E2DFD7] dark:border-[#2A2F36] pt-2.5 font-mono text-[10px] text-[#7F8892] dark:text-[#68707B]">
                    <span>Vol {t.totalWagered.toFixed(1)} SOL</span>
                    <span>
                      Win {t.winRate !== null ? `${Math.round(t.winRate)}%` : "—"}
                    </span>
                    <span>{t.marketsTraded} mkts</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Timeframe note */}
      <p className="mt-8 text-center font-mono text-[11px] text-[#7F8892] dark:text-[#68707B]">
        Rankings reflect lifetime on-chain exchange volume and settlement P&amp;L.
      </p>
    </main>
  );
}

export default LeaderboardPage;
