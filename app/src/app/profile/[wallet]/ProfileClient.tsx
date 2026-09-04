"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { keys } from "@/lib/api/keys";
export interface UserProfile {
  wallet: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  twitterHandle?: string;
  totalWagered: number;
  totalWon: number;
  totalProfit: number;
  marketsTraded: number;
  winRate: number;
  pasScore: number;
  createdAt?: string;
}

export interface Position {
  marketPubkey: string;
  question: string;
  side: "YES" | "NO";
  shares: number;
  avgPriceSol: number;
  currentPriceSol: number;
  valueSol: number;
  pnlSol: number;
  pnlPercent: number;
}

export interface ActivityEntry {
  signature: string;
  marketPubkey: string;
  trader: string;
  side: string;
  lamportsIn: string;
  tokensOut: string;
  blockTime: string;
  question: string;
}

export interface Achievement {
  key: string;
  title: string;
  desc: string;
  unlocked: boolean;
  progress: number;
}

export interface ProfileClientProps {
  wallet: string;
  initialProfile?: UserProfile | null;
  initialPositions?: Position[];
  initialActivities?: ActivityEntry[];
  initialAchievements?: Achievement[];
}

export default function ProfileClient({
  wallet,
  initialProfile,
  initialPositions,
  initialActivities,
  initialAchievements,
}: ProfileClientProps) {
  const [activeTab, setActiveTab] = useState("positions");

  const profileQuery = useQuery({
    queryKey: keys.user.profile(wallet ?? "none"),
    queryFn: async (): Promise<UserProfile | null> => {
      if (!wallet) return null;
      const r = await fetch(`/api/user/profile/${wallet}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data?.ok ? (data.profile as UserProfile) : null;
    },
    enabled: !!wallet,
    staleTime: 30_000,
    // Seeded from the server-rendered page so the first paint shows the real
    // profile without waiting on the API round trip. Refetches after staleTime.
    initialData: initialProfile ?? null,
    // Mark the prefetched data fresh from mount so the client first-paint
    // matches the server exactly (no hydration mismatch from an immediate
    // background refetch resolving before React hydrates).
    initialDataUpdatedAt: () => Date.now(),
  });

  const positionsQuery = useQuery({
    queryKey: keys.user.positions(wallet ?? "none"),
    queryFn: async (): Promise<Position[]> => {
      if (!wallet) return [];
      const r = await fetch(`/api/user/positions?wallet=${wallet}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data?.ok ? (data.positions as Position[]) : [];
    },
    enabled: !!wallet,
    staleTime: 30_000,
    initialData: initialPositions ?? [],
    initialDataUpdatedAt: () => Date.now(),
  });

  const activityQuery = useQuery({
    queryKey: ["activity", "recent", wallet ?? "none"],
    queryFn: async (): Promise<ActivityEntry[]> => {
      if (!wallet) return [];
      const r = await fetch(`/api/activity/recent?wallet=${wallet}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data?.ok ? (data.activities as ActivityEntry[]) : [];
    },
    enabled: !!wallet,
    staleTime: 30_000,
    initialData: initialActivities ?? [],
    initialDataUpdatedAt: () => Date.now(),
  });

  const achievementsQuery = useQuery({
    queryKey: ["achievements", wallet ?? "none"],
    queryFn: async (): Promise<Achievement[]> => {
      if (!wallet) return [];
      const r = await fetch(`/api/user/achievements?wallet=${wallet}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data?.ok ? (data.achievements as Achievement[]) : [];
    },
    enabled: !!wallet,
    staleTime: 30_000,
    initialData: initialAchievements ?? [],
    initialDataUpdatedAt: () => Date.now(),
  });

  const loading =
    profileQuery.isLoading ||
    positionsQuery.isLoading ||
    activityQuery.isLoading;

  const profile = profileQuery.data ?? null;
  const positions = positionsQuery.data ?? [];
  const activities = activityQuery.data ?? [];
  const achievements = achievementsQuery.data ?? [];
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const shortAddr = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : "";
  const username = profile?.username || `@${shortAddr}`;
  const winRate = profile?.winRate ?? null;

  const stats = [
    {
      label: "Total Volume",
      value:
        profile?.totalWagered != null
          ? `${profile.totalWagered.toFixed(2)} SOL`
          : "\u2014",
    },
    {
      label: "Markets Traded",
      value:
        profile?.marketsTraded != null
          ? String(profile.marketsTraded)
          : positions.length
          ? String(positions.length)
          : "\u2014",
    },
    {
      label: "Win Rate",
      value: winRate != null ? `${winRate.toFixed(0)}%` : "\u2014",
    },
    {
      label: "PAS Score",
      value: profile?.pasScore != null ? String(profile.pasScore) : "\u2014",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-10">
      <div className="surface rounded-[8px] p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          <div className="flex items-center gap-5 flex-shrink-0">
            <div
              className="w-20 h-20 rounded-[8px] border-2 border-ink bg-yellow p-[3px] flex-shrink-0"
              aria-hidden
            >
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external avatar URLs; next/image would need remotePatterns config
                <img
                  src={profile.avatarUrl}
                  alt={username}
                  className="w-full h-full rounded-[6px] object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-[6px] bg-cream flex items-center justify-center font-bold text-2xl text-ink">
                  {wallet.slice(0, 2)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="font-display text-[30px] font-extrabold text-ink tracking-tight">
                  {username}
                </h1>
                <span className="num font-mono text-[11px] text-ash bg-sheet px-2 py-0.5 rounded-[4px] border border-hairline">
                  {shortAddr}
                </span>
              </div>
              <p className="text-ash mb-2.5 text-[13px]">
                {profile?.bio || "Solana Prediction Market Trader"}
              </p>
              {profile?.twitterHandle && (
                <a
                  href={`https://twitter.com/${profile.twitterHandle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="num font-mono text-xs text-inkblue hover:underline flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> @
                  {profile.twitterHandle}
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto lg:ml-auto">
            {stats.map((s, idx) => (
              <div
                key={s.label}
                className={`surface rounded-[8px] text-center p-4 min-w-[110px] border-t-4 ${
                  idx === 0
                    ? "border-t-cyan"
                    : idx === 1
                    ? "border-t-magenta"
                    : idx === 2
                    ? "border-t-grass"
                    : "border-t-yellow"
                }`}
              >
                <p className="num font-mono text-[20px] font-bold text-ink leading-none">
                  {s.value}
                </p>
                <p className="text-[10px] text-ash uppercase font-mono tracking-[.12em] mt-1.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {["positions", "activity", "achievements"].map((tab) => {
          const active = activeTab === tab;
          const count =
            tab === "positions"
              ? positions.length
              : tab === "activity"
              ? activities.length
              : unlockedCount;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-pressed={active}
              className={`px-4 h-10 rounded-[4px] text-[12px] font-semibold uppercase tracking-wide border-2 transition-all snap ${
                active
                  ? "bg-ink-fill text-white border-ink-fill"
                  : "text-ash border-hairline hover:border-hairline-2 hover:text-ink"
              }`}
            >
              {tab}
              <span
                className={`ml-1.5 num font-mono text-[11px] ${
                  active ? "text-yellow" : "text-ash-dim"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="surface rounded-[8px] p-5 sm:p-6">
        {loading ? (
          <div className="py-12 text-center text-ash animate-pulse">
            Loading profile data...
          </div>
        ) : activeTab === "positions" ? (
          positions.length === 0 ? (
            <div className="py-12 text-center text-ash">
              No active positions found for this trader.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-ash uppercase tracking-wider border-b border-hairline">
                    <th className="pb-3 pr-4 font-mono text-[10px] tracking-[.14em]">
                      Market
                    </th>
                    <th className="pb-3 pr-4 font-mono text-[10px] tracking-[.14em]">
                      Side
                    </th>
                    <th className="pb-3 pr-4 text-right font-mono text-[10px] tracking-[.14em]">
                      Shares
                    </th>
                    <th className="pb-3 pr-4 text-right font-mono text-[10px] tracking-[.14em]">
                      Avg Price
                    </th>
                    <th className="pb-3 pr-4 text-right font-mono text-[10px] tracking-[.14em]">
                      Current Value
                    </th>
                    <th className="pb-3 pr-4 text-right font-mono text-[10px] tracking-[.14em]">
                      P&L
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[13px] text-ink font-mono">
                  {positions.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-hairline hover:bg-sheet transition-colors"
                    >
                      <td className="py-4 pr-4 font-sans font-medium text-xs max-w-xs truncate">
                        <Link
                          href={`/market/${p.marketPubkey}`}
                          className="text-ink hover:text-magenta"
                        >
                          {p.question}
                        </Link>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${
                            p.side === "YES"
                              ? "bg-yes-fill text-ink border-2 border-ink"
                              : "border-2 border-no bg-cream text-ink"
                          }`}
                        >
                          {p.side}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right text-xs num">
                        {p.shares.toFixed(2)}
                      </td>
                      <td className="py-4 pr-4 text-right text-xs num">
                        {p.avgPriceSol.toFixed(2)} SOL
                      </td>
                      <td className="py-4 pr-4 text-right text-xs num">
                        {p.valueSol.toFixed(2)} SOL
                      </td>
                      <td
                        className={`py-4 pr-4 text-right text-xs font-bold num ${
                          p.pnlSol >= 0 ? "text-grass" : "text-magenta"
                        }`}
                      >
                        {p.pnlSol >= 0 ? "+" : ""}
                        {p.pnlSol.toFixed(3)} SOL ({p.pnlPercent.toFixed(1)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === "achievements" ? (
          achievements.length === 0 ? (
            <div className="py-12 text-center text-ash">
              No achievements available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((a) => (
                <div
                  key={a.key}
                  className={`p-4 rounded-[8px] border-2 transition-colors ${
                    a.unlocked
                      ? "border-ink bg-yellow"
                      : "border-hairline bg-sheet opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[15px] ${
                        a.unlocked ? "text-ink" : "text-ash-dim"
                      }`}
                    >
                      {a.unlocked ? "●" : "○"}
                    </span>
                    <div className="flex-1">
                      <div className="text-[13px] font-bold text-ink">
                        {a.title}
                      </div>
                      <div className="text-[11px] text-ash leading-snug">
                        {a.desc}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 bg-ink/15 rounded-[2px] overflow-hidden">
                      <div
                        className={`h-full rounded-[2px] ${
                          a.unlocked ? "bg-ink" : "bg-ash/50"
                        }`}
                        style={{
                          width: `${Math.max(4, Math.min(100, a.progress))}%`,
                        }}
                      />
                    </div>
                    <div className="text-[9px] text-ash mt-1 text-right font-mono">
                      {a.unlocked ? "UNLOCKED" : `${a.progress}%`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activities.length === 0 ? (
          <div className="py-12 text-center text-ash">
            No trade activity recorded for this trader yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-ash uppercase tracking-wider border-b border-hairline">
                  <th className="pb-3 pr-4 font-mono text-[10px] tracking-[.14em]">
                    Market
                  </th>
                  <th className="pb-3 pr-4 font-mono text-[10px] tracking-[.14em]">
                    Side
                  </th>
                  <th className="pb-3 pr-4 text-right font-mono text-[10px] tracking-[.14em]">
                    Amount
                  </th>
                  <th className="pb-3 pr-4 text-right font-mono text-[10px] tracking-[.14em]">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="text-[13px] text-ink font-mono">
                {activities.map((a, i) => (
                  <tr
                    key={i}
                    className="border-b border-hairline hover:bg-sheet transition-colors"
                  >
                    <td className="py-4 pr-4 font-sans font-medium text-xs max-w-xs truncate">
                      <Link
                        href={`/market/${a.marketPubkey}`}
                        className="text-ink hover:text-magenta"
                      >
                        {a.question}
                      </Link>
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${
                          String(a.side).toUpperCase() === "YES"
                            ? "bg-yes-fill text-ink border-2 border-ink"
                            : "border-2 border-no bg-cream text-ink"
                        }`}
                      >
                        {String(a.side).toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-right text-xs num">
                      {((Number(a.lamportsIn) || 0) / 1e9).toFixed(3)} SOL
                    </td>
                    <td className="py-4 pr-4 text-right text-xs text-ash">
                      {a.blockTime
                        ? new Date(Number(a.blockTime) * 1000).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
