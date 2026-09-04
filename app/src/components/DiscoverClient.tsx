"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, Clock } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import { MarketCard } from "@/components/MarketCard";
import { keys } from "@/lib/api/keys";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

interface TraderEntry {
  rank: number;
  wallet: string;
  username: string;
  avatarUrl: string;
  totalWagered: number;
  totalProfit: number;
  winRate: number | null;
  marketsTraded: number;
}

const DISCOVER_CATEGORIES = [
  "All",
  "Crypto",
  "Politics",
  "Sports",
  "Tech",
  "Other",
];

const CATEGORY_BLOCK: Record<string, string> = {
  Crypto: "bg-cyan text-ink-static",
  Sports: "bg-grass text-ink-static",
  Politics: "bg-magenta text-white dark:text-ink-static",
  Tech: "bg-yellow text-ink-static",
  Other: "bg-sheet text-ink border border-hairline",
};

interface DiscoverClientProps {
  initialMarkets: MarketCacheEntry[];
  initialTopTraders?: TraderEntry[];
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function DiscoverClient({
  initialMarkets,
  initialTopTraders,
}: DiscoverClientProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { markets: onChainMarkets, loading } = useMarkets(
    10_000,
    initialMarkets
  );

  const { data: topTraders = [] } = useQuery({
    queryKey: [...keys.leaderboard.list("all", "profit"), { slice: 6 }],
    queryFn: async (): Promise<TraderEntry[]> => {
      const r = await fetch("/api/leaderboard");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data?.ok && data.leaderboard)
        return data.leaderboard.slice(0, 6) as TraderEntry[];
      return [];
    },
    staleTime: 60_000,
    enabled: mounted,
  });

  const markets = onChainMarketsToUi(onChainMarkets ?? []);
  const categoryMarkets =
    activeCategory === "All"
      ? markets
      : markets.filter((m) => m.category === activeCategory);

  const trendingMarkets = categoryMarkets
    .filter((m) => m.liquidity > 0)
    .sort((a, b) => b.liquidity - a.liquidity)
    .slice(0, 8);

  const closingSoon = categoryMarkets
    .filter((m) => m.status !== "settled" && m.status !== "cancelled")
    .sort(
      (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    )
    .slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-2 h-8 bg-cyan rounded-[2px]" aria-hidden />
          <h1 className="font-display text-[36px] font-black text-ink tracking-tight">
            Discover
          </h1>
        </div>
        <p className="text-[14px] text-ink-soft font-medium pl-5">
          Trending markets and top traders
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar">
        {DISCOVER_CATEGORIES.map((cat) => {
          const active = activeCategory === cat;
          const count =
            cat === "All"
              ? markets.length
              : markets.filter((m) => m.category === cat).length;
          const block =
            cat === "All"
              ? active
                ? "bg-ink-fill text-white shadow-sm"
                : "bg-cream border-2 border-ink text-ink hover:bg-sheet"
              : active
              ? `${CATEGORY_BLOCK[cat]} shadow-sm`
              : "bg-cream border border-hairline text-ink hover:border-ink hover:bg-sheet";
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              aria-pressed={active}
              className={`shrink-0 px-4 h-10 rounded-[4px] text-[12px] font-bold whitespace-nowrap transition-all snap ${block}`}
            >
              {cat}
              <span
                className={`ml-1.5 num text-[10px] ${
                  active ? "opacity-70" : "text-ash"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Trending Markets */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-1.5 h-5 bg-magenta rounded-[1px]" aria-hidden />
          <h2 className="font-display text-[21px] font-extrabold text-ink">
            Trending Markets
          </h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="surface h-56 shimmer relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent animate-[shimmer_1.8s_infinite]" />
              </div>
            ))}
          </div>
        ) : trendingMarkets.length === 0 ? (
          <div className="surface p-14 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-sheet flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-ash" />
            </div>
            <div className="font-semibold text-ash text-[13px]">
              No markets yet.{" "}
              <Link
                href="/create"
                className="text-ink underline decoration-magenta decoration-2"
              >
                Create one
              </Link>
              .
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {trendingMarkets.map((m, i) => (
              <Link key={m.id} href={`/market/${m.id}`}>
                <MarketCard market={m} index={i} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Closing soon */}
      {closingSoon.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-5 bg-yellow rounded-[1px]" aria-hidden />
            <h2 className="font-display text-[21px] font-extrabold text-ink">
              Closing Soon
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {closingSoon.map((m, i) => (
              <Link key={m.id} href={`/market/${m.id}`}>
                <MarketCard market={m} index={i} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top Traders */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <span className="w-1.5 h-5 bg-grass rounded-[1px]" aria-hidden />
          <h2 className="font-display text-[21px] font-extrabold text-ink">
            Top Traders
          </h2>
        </div>
        {!mounted ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="panel-lux p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-[4px] bg-sheet animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-sheet animate-pulse rounded-[2px]" />
                  <div className="h-2.5 w-32 bg-sheet/70 animate-pulse rounded-[2px]" />
                </div>
              </div>
            ))}
          </div>
        ) : topTraders.length === 0 ? (
          <div className="surface p-12 text-center font-semibold text-ash">
            No trader data yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topTraders.map((t, i) => (
              <Link
                key={t.wallet}
                href={`/profile/${t.wallet}`}
                className="group"
              >
                <div className="relative bg-cream border border-hairline rounded-[8px] shadow-panel p-4 flex items-center gap-3 hover:border-ink hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200 snap overflow-hidden">
                  {i < 3 && (
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 ${
                        i === 0
                          ? "bg-yellow"
                          : i === 1
                          ? "bg-sheet border-b border-hairline"
                          : "bg-magenta/60"
                      }`}
                    />
                  )}
                  <div
                    className="relative w-12 h-12 rounded-[6px] bg-ink-fill text-white flex items-center justify-center text-[18px] font-bold shrink-0"
                    aria-hidden
                  >
                    {(t.username || t.wallet)[0].toUpperCase()}
                    <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-magenta text-white dark:text-ink-static text-[9px] font-mono font-bold flex items-center justify-center rounded-full border-2 border-cream">
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="num font-mono font-bold text-ink truncate group-hover:text-magenta transition-colors">
                      {t.username || shortAddr(t.wallet)}
                    </div>
                    <div className="text-xs text-ash mt-0.5 font-medium">
                      <span className="num text-ink font-bold">
                        {(t.totalWagered ?? 0).toFixed(1)} ◎
                      </span>
                      <span className="mx-1.5 text-hairline-2">·</span>
                      Win{" "}
                      <span className="num font-bold">
                        {t.winRate != null
                          ? `${t.winRate.toFixed(0)}%`
                          : "\u2014"}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
