"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Activity,
  Layers,
  Users,
  ShieldCheck,
  Search,
  Flame,
  Compass,
} from "lucide-react";
import { MarketCard } from "@/components/MarketCard";
import { WatchlistExpiryChecker } from "@/components/WatchlistExpiryChecker";
import type { UiMarket } from "@/lib/market-adapter";
import { useMarkets } from "@/hooks/useMarkets";
import { usePlatformStats, type PlatformStats } from "@/hooks/usePlatformStats";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

const HOME_CATEGORIES = [
  "All",
  "Crypto",
  "Sports",
  "Politics",
  "Tech",
  "Other",
] as const;

export default function HomeClient({
  initialMarkets,
  initialStats,
}: {
  initialMarkets: MarketCacheEntry[];
  initialStats: PlatformStats | null;
}) {
  const router = useRouter();
  const [category, setCategory] =
    useState<(typeof HOME_CATEGORIES)[number]>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { markets: onChainMarkets, loading } = useMarkets(
    10_000,
    initialMarkets
  );
  const { data: stats } = usePlatformStats(initialStats);

  const MARKETS: UiMarket[] = useMemo(
    () => onChainMarketsToUi(onChainMarkets ?? []),
    [onChainMarkets]
  );

  const openMarket = (m: UiMarket) => {
    router.push(`/market/${m.id}`);
  };

  const filteredMarkets = useMemo(() => {
    let list = MARKETS;
    if (category !== "All") {
      list = list.filter((m) => m.category === category);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.question.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [MARKETS, category, searchQuery]);

  const trendingMarkets = useMemo(
    () =>
      [...MARKETS]
        .filter((m) => m.status === "open")
        .sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0))
        .slice(0, 4),
    [MARKETS]
  );

  const volume24hNum = stats ? Number(stats.volume24h ?? 0) : 0;
  const totalVolumeNum = stats ? Number(stats.totalVolume ?? 0) : 0;
  const totalTradersNum = stats ? Number(stats.totalTraders ?? 0) : 0;
  const openMarketsNum = stats ? Number(stats.openMarkets ?? 0) : MARKETS.length;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-ground,#F8F7F4)] text-[var(--color-ink,#181A1C)] transition-colors">
      <WatchlistExpiryChecker
        markets={initialMarkets.map((m) => ({
          marketPubkey: m.marketPubkey,
          marketId: m.marketId,
          question: m.question,
          status: m.status,
          endTs:
            m.endTs instanceof Date ? m.endTs.toISOString() : String(m.endTs),
        }))}
      />

      {/* ── EDITORIAL FINANCIAL HERO ── */}
      <section className="relative border-b border-[#E2DFD7] dark:border-[#2A2F36] py-10 sm:py-14 bg-white dark:bg-[#16181C]">
        <div className="relative mx-auto max-w-[1360px] px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-2xl space-y-5">
              {/* Live Status Tag */}
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[3px] bg-[#F1EFEA] dark:bg-[#1F2329] border border-[#E2DFD7] dark:border-[#2E353F]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1D7C59]" />
                <span className="text-[10px] text-[#555D65] dark:text-[#9AA1AA] font-semibold font-mono tracking-wider">
                  SOLANA DEVNET · AMM V1 ACTIVE · PYTH ORACLES
                </span>
              </div>

              {/* Bold Editorial Headline */}
              <h1
                className="text-[34px] sm:text-[46px] lg:text-[52px] font-bold tracking-tight text-[#181A1C] dark:text-[#EAE8E3] leading-[1.08]"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Prediction Exchange <br className="hidden sm:inline" />
                <span className="text-[#1F3A52] dark:text-[#7A9BB5]">
                  on Solana.
                </span>
              </h1>

              <p className="text-[14px] sm:text-[15px] text-[#555D65] dark:text-[#9AA1AA] leading-relaxed max-w-[54ch]">
                The high-performance prediction exchange. Trade YES and NO shares on crypto, macro, and world events with continuous CPMM liquidity and instant on-chain settlement.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Link
                  href="/markets"
                  className="inline-flex items-center gap-1.5 px-4 h-9 rounded-[3px] bg-[#1F3A52] hover:bg-[#16293B] text-white font-medium text-[12px] transition-colors cursor-pointer"
                >
                  Explore Markets <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/create"
                  className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] hover:bg-[#F1EFEA] dark:hover:bg-[#21252A] text-[#181A1C] dark:text-[#EAE8E3] font-medium text-[12px] transition-colors cursor-pointer"
                >
                  + Propose Market
                </Link>
              </div>
            </div>

            {/* ── STAT RAIL — 4 Flat Editorial Metric Tiles ── */}
            <div className="grid grid-cols-2 gap-2.5 w-full lg:w-[460px]">
              <div className="p-3.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F8F7F4] dark:bg-[#1A1D21] flex flex-col justify-between">
                <span className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#9AA1AA]">
                  Active Lines
                  <Activity className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
                </span>
                <span
                  className="text-[24px] font-bold text-[#181A1C] dark:text-[#EAE8E3] tabular-nums mt-1 font-mono"
                >
                  {openMarketsNum}
                </span>
                <span className="text-[10px] text-[#1D7C59] font-mono mt-0.5">● Live on devnet</span>
              </div>

              <div className="p-3.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F8F7F4] dark:bg-[#1A1D21] flex flex-col justify-between">
                <span className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#9AA1AA]">
                  24h Volume
                  <Flame className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
                </span>
                <span
                  className="text-[24px] font-bold text-[#181A1C] dark:text-[#EAE8E3] tabular-nums mt-1 font-mono"
                >
                  {volume24hNum.toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  <span className="text-[12px] text-[#7F8892] dark:text-[#68707B] font-normal ml-1">SOL</span>
                </span>
                <span className="text-[10px] text-[#7F8892] dark:text-[#68707B] font-mono mt-0.5">24h volume traded</span>
              </div>

              <div className="p-3.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F8F7F4] dark:bg-[#1A1D21] flex flex-col justify-between">
                <span className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#9AA1AA]">
                  Total Volume
                  <Layers className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
                </span>
                <span
                  className="text-[24px] font-bold text-[#181A1C] dark:text-[#EAE8E3] tabular-nums mt-1 font-mono"
                >
                  {totalVolumeNum.toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  <span className="text-[12px] text-[#7F8892] dark:text-[#68707B] font-normal ml-1">SOL</span>
                </span>
                <span className="text-[10px] text-[#7F8892] dark:text-[#68707B] font-mono mt-0.5">Lifetime settled</span>
              </div>

              <div className="p-3.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F8F7F4] dark:bg-[#1A1D21] flex flex-col justify-between">
                <span className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#9AA1AA]">
                  Traders
                  <Users className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
                </span>
                <span
                  className="text-[24px] font-bold text-[#181A1C] dark:text-[#EAE8E3] tabular-nums mt-1 font-mono"
                >
                  {totalTradersNum.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#7F8892] dark:text-[#68707B] font-mono mt-0.5">Connected accounts</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-8 flex-1 flex flex-col gap-9">
        {/* ── TRENDING MARKETS ── */}
        {trendingMarkets.length > 0 && (
          <section className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#E2DFD7] dark:border-[#2A2F36] pb-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] sm:text-[18px] font-bold tracking-tight text-[#181A1C] dark:text-[#EAE8E3]">
                  Trending Markets
                </h2>
              </div>
              <Link
                href="/markets"
                className="font-sans text-[12px] font-medium text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {trendingMarkets.map((m, i) => (
                <MarketCard
                  key={m.id}
                  market={m}
                  index={i}
                  onClick={() => openMarket(m)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── ALL MARKETS DIRECTORY ── */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2DFD7] dark:border-[#2A2F36] pb-4">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {HOME_CATEGORIES.map((cat) => {
                const active = category === cat;
                const count =
                  cat === "All"
                    ? MARKETS.length
                    : MARKETS.filter((m) => m.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`shrink-0 px-3 h-7 rounded-[3px] font-medium text-[11px] transition-colors cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? "bg-[#1F3A52] text-white"
                        : "bg-white dark:bg-[#1A1D21] text-[#555D65] dark:text-[#9AA1AA] border border-[#E2DFD7] dark:border-[#2A2F36] hover:bg-[#F1EFEA] dark:hover:bg-[#21252A] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] tabular-nums font-mono ${
                        active ? "text-white/80" : "text-[#7F8892] dark:text-[#68707B]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7F8892] dark:text-[#68707B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search markets..."
                className="w-full h-8 pl-8 pr-3 bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] text-[12px] text-[#181A1C] dark:text-[#EAE8E3] placeholder-[#7F8892] dark:placeholder-[#68707B] focus:outline-none focus:border-[#1F3A52] dark:focus:border-[#7A9BB5] transition-colors"
              />
            </div>
          </div>

          {/* Cards Grid */}
          {loading && filteredMarkets.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="h-60 rounded-[3px] bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] animate-pulse"
                />
              ))}
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div className="p-12 text-center rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21]">
              <Compass className="w-8 h-8 mx-auto text-[#7F8892] dark:text-[#68707B] mb-2" />
              <h3 className="text-[15px] font-bold text-[#181A1C] dark:text-[#EAE8E3] mb-1">
                No Markets Found
              </h3>
              <p className="font-mono text-[12px] text-[#7F8892] dark:text-[#68707B]">
                {searchQuery
                  ? `No lines match "${searchQuery}".`
                  : "No open markets available in this category."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredMarkets.map((m, i) => (
                <MarketCard
                  key={m.id}
                  market={m}
                  index={i}
                  onClick={() => openMarket(m)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── PROTOCOL TECHNICAL SPECS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-6 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
          <div className="p-4 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21]">
            <div className="text-[12px] font-semibold text-[#1F3A52] dark:text-[#7A9BB5] mb-1 flex items-center gap-1.5 font-mono uppercase tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5" />
              Constant-Product AMM
            </div>
            <p className="text-[12px] text-[#555D65] dark:text-[#9AA1AA] leading-relaxed">
              Transparent CPMM bonding curves provide continuous liquidity and deterministic pricing. Zero hidden spreads.
            </p>
          </div>

          <div className="p-4 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21]">
            <div className="text-[12px] font-semibold text-[#1F3A52] dark:text-[#7A9BB5] mb-1 flex items-center gap-1.5 font-mono uppercase tracking-wide">
              <Activity className="w-3.5 h-3.5" />
              Pyth Low-Latency Oracle
            </div>
            <p className="text-[12px] text-[#555D65] dark:text-[#9AA1AA] leading-relaxed">
              Crypto price lines settle automatically against high-frequency Pyth pull feeds the second they expire.
            </p>
          </div>

          <div className="p-4 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21]">
            <div className="text-[12px] font-semibold text-[#1F3A52] dark:text-[#7A9BB5] mb-1 flex items-center gap-1.5 font-mono uppercase tracking-wide">
              <Layers className="w-3.5 h-3.5" />
              Non-Custodial Settlement
            </div>
            <p className="text-[12px] text-[#555D65] dark:text-[#9AA1AA] leading-relaxed">
              Every position and LP token lives directly in your Solana wallet. Claim winnings and fee yield with instant on-chain transactions.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
