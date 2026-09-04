"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { LabelLux } from "@/components/ui/label-lux";
import { Rule } from "@/components/ui/rule";
import { StatCard } from "@/components/ui/stat-card";
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

const CATEGORY_BLOCK: Record<string, string> = {
  Crypto: "bg-cyan text-ink-static",
  Sports: "bg-grass text-ink-static",
  Politics: "bg-magenta text-white dark:text-ink-static",
  Tech: "bg-yellow text-ink-static",
  Other: "bg-sheet text-ink border border-hairline",
};

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
  const { markets: onChainMarkets, loading } = useMarkets(
    10_000,
    initialMarkets
  );

  const MARKETS: UiMarket[] = useMemo(
    () => onChainMarketsToUi(onChainMarkets ?? []),
    [onChainMarkets]
  );

  const openMarket = (m: UiMarket) => {
    router.push(`/market/${m.id}`);
  };

  const filteredMarkets = useMemo(
    () =>
      category === "All"
        ? MARKETS
        : MARKETS.filter((m) => m.category === category),
    [MARKETS, category]
  );

  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink">
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
      <HomeHero
        markets={MARKETS}
        onOpenMarket={openMarket}
        initialStats={initialStats}
        loading={loading && MARKETS.length === 0}
      />
      <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 pt-8 pb-16">
        <HomeSections
          markets={filteredMarkets}
          allMarkets={MARKETS}
          category={category}
          setCategory={setCategory}
          onOpenMarket={openMarket}
          loading={loading && MARKETS.length === 0}
          initialStats={initialStats}
        />
      </main>
    </div>
  );
}

type HeroProps = {
  markets: UiMarket[];
  onOpenMarket: (m: UiMarket) => void;
  loading: boolean;
  initialStats?: PlatformStats | null;
};

function HomeHero(props: HeroProps) {
  const { loading } = props;
  if (loading) {
    return (
      <section className="relative py-14 md:py-20 overflow-hidden">
        <div className="absolute inset-0 hero-gradient pointer-events-none" />
        <div className="relative mx-auto w-full max-w-[1240px] px-4 sm:px-6">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
            <div className="flex-1">
              <div className="w-40 h-2.5 bg-sheet rounded shimmer mb-6" />
              <div className="w-2/3 h-20 bg-sheet rounded shimmer" />
              <div className="mt-3 w-full max-w-[40ch] h-14 bg-sheet rounded shimmer" />
              <div className="mt-6 flex gap-3">
                <div className="w-36 h-12 bg-sheet rounded shimmer" />
                <div className="w-36 h-12 bg-sheet rounded shimmer" />
              </div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 bg-sheet rounded shimmer" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }
  return <HeroInnards {...props} />;
}

function HeroInnards({
  markets,
  initialStats,
}: Pick<HeroProps, "markets" | "initialStats">) {
  const { data: stats } = usePlatformStats(initialStats);
  const volume24hNum = stats ? Number(stats.volume24h ?? 0) : 0;
  const totalVolumeNum = stats ? Number(stats.totalVolume ?? 0) : 0;

  return (
    <section className="relative py-14 md:py-20 overflow-hidden">
      {/* Subtle CMYK gradient background */}
      <div className="absolute inset-0 hero-gradient pointer-events-none" />
      <div className="relative mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        {/* CMYK block hero — the signature Studio Signal composition */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
          {/* Text column */}
          <div className="flex-1 max-w-[680px]">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="live-dot !bg-yes !before:bg-yes" />
              <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-ash">
                Live on Solana
              </span>
              <span
                className="hidden sm:inline-flex h-4 w-px bg-hairline"
                aria-hidden
              />
              <span className="hidden sm:inline font-mono text-[10px] font-bold tracking-wider uppercase text-ash-dim">
                CPMM · Pyth · On-chain
              </span>
            </div>

            <h1
              className="font-display font-black text-ink"
              style={{
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
              }}
            >
              Conviction,
              <br />
              <span className="relative inline-block">
                <span className="bg-magenta text-white dark:text-ink-static px-2.5 py-0.5 rounded-[4px] inline-block">
                  priced.
                </span>
                <span className="absolute -bottom-1 left-0 right-0 h-1 bg-magenta/20 rounded-full blur-sm" />
              </span>
            </h1>

            <p className="text-[15px] text-ink-soft leading-relaxed mt-7 max-w-[48ch]">
              Trade YES or NO on the future. Constant-product pricing, Pyth
              oracle resolution, and pro-rata on-chain payouts. Understand the
              odds in seconds — no crypto fluency required.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-8">
              <Link
                href="/markets"
                className="inline-flex items-center gap-2 px-6 h-12 rounded-[4px] bg-ink-fill text-white hover:bg-ink-fill-fill-soft text-[14px] font-bold transition-all snap card-hover-glow"
              >
                Browse Markets <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 px-6 h-12 rounded-[4px] border-2 border-ink text-ink hover:bg-yellow hover:text-ink-static text-[14px] font-bold transition-all snap"
              >
                Propose a Market
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-4 mt-8 text-[11px] font-mono text-ash-dim">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yes" />
                On-chain settlement
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-inkblue" />
                Pyth oracle
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-magenta" />
                No custody
              </span>
            </div>
          </div>

          {/* CMYK stat blocks — the modular colour field */}
          {stats && (
            <div className="flex-1 grid grid-cols-3 gap-3 min-w-0">
              <StatCard
                label="Open"
                value={stats.openMarkets ?? 0}
                accent="cyan"
                className="min-w-0 card-hover-glow"
              />
              <StatCard
                label="Volume"
                value={totalVolumeNum}
                decimals={1}
                suffix=" SOL"
                accent="magenta"
                hint={`${volume24hNum.toFixed(1)} SOL 24h`}
                className="min-w-0 card-hover-glow"
              />
              <StatCard
                label="Traders"
                value={stats.totalTraders ?? 0}
                accent="grass"
                className="min-w-0 card-hover-glow"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HomeSections({
  markets,
  allMarkets,
  category,
  setCategory,
  onOpenMarket,
  loading,
  initialStats,
}: HeroProps & {
  allMarkets: UiMarket[];
  category: (typeof HOME_CATEGORIES)[number];
  setCategory: (c: (typeof HOME_CATEGORIES)[number]) => void;
}) {
  const trending = useMemo(
    () =>
      allMarkets
        .filter((m) => m.liquidity > 0)
        .sort((a, b) => b.liquidity - a.liquidity)
        .slice(0, 8),
    [allMarkets]
  );

  return (
    <div>
      {/* Featured / Trending */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-ink-fill text-white">
            <span className="live-dot !w-[6px] !h-[6px] !before:bg-yes" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[.15em]">
              Top liquidity
            </span>
          </span>
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
        ) : trending.length === 0 ? (
          <div className="surface p-14 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-sheet flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-ash" />
            </div>
            <div className="font-mono text-[12px] text-ash font-semibold">
              No open markets yet.
            </div>
            <div className="text-[11px] text-ash-dim mt-1">Check back soon</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trending.map((m, i) => (
              <MarketCard
                key={m.id}
                market={m}
                index={i}
                onClick={() => onOpenMarket(m)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Category filters — solid CMYK blocks */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar">
        {HOME_CATEGORIES.map((cat) => {
          const active = category === cat;
          const count =
            cat === "All"
              ? allMarkets.length
              : allMarkets.filter((m) => m.category === cat).length;
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
              onClick={() => setCategory(cat)}
              aria-pressed={active}
              className={`shrink-0 px-4 h-10 rounded-[4px] text-[12px] font-bold transition-all cursor-pointer snap ${block}`}
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

      <section className="rise" style={{ animationDelay: ".1s" }}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <LabelLux className="mb-1">Live Markets</LabelLux>
            <h2 className="font-display text-[22px] font-extrabold text-ink">
              {category === "All" ? "All markets" : `${category} markets`}
            </h2>
          </div>
          <Link
            href="/markets"
            className="group flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ash hover:text-ink transition-colors"
          >
            View all
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {markets.length === 0 ? (
          <div className="surface p-14 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-sheet flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-ash" />
            </div>
            <div className="font-mono text-[12px] text-ash font-semibold">
              No markets in this category yet.
            </div>
            <div className="text-[11px] text-ash-dim mt-1">
              Try another category
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {markets.slice(0, 8).map((m, i) => (
              <MarketCard
                key={m.id}
                market={m}
                index={i}
                onClick={() => onOpenMarket(m)}
              />
            ))}
          </div>
        )}
      </section>

      <Rule className="mt-14" />

      {/* Intro stats strip */}
      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Volume"
          value={Number(initialStats?.totalVolume ?? 0)}
          decimals={1}
          suffix=" SOL"
          accent="cyan"
        />
        <StatCard
          label="Liquidity"
          value={Number(initialStats?.totalLiquidity ?? 0)}
          decimals={1}
          suffix=" SOL"
          accent="magenta"
        />
        <StatCard
          label="Traders"
          value={Number(initialStats?.totalTraders ?? 0)}
          staticValue={String(initialStats?.totalTraders ?? "—")}
          accent="grass"
        />
        <StatCard
          label="Resolved"
          value={Number(initialStats?.settledMarkets ?? 0)}
          staticValue={String(initialStats?.settledMarkets ?? "—")}
          accent="yellow"
        />
      </section>

      {/* How it works */}
      <section className="py-14">
        <div className="flex items-center gap-2 mb-10">
          <span className="w-1.5 h-5 bg-cyan rounded-[1px]" />
          <h2 className="font-display font-extrabold text-[20px] text-ink">
            How it works
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              title: "Constant-Product Pricing",
              body: "Every trade moves a CPMM curve. You see price impact before you commit — no hidden spreads, no order book to front-run.",
              accent: "bg-cyan",
              number: "01",
            },
            {
              title: "Oracle Resolution",
              body: "Crypto markets settle against Pyth pull feeds the moment they expire. No admin discretion, no waiting for a human to press a button.",
              accent: "bg-magenta",
              number: "02",
            },
            {
              title: "On-Chain Payout",
              body: "Winning shares redeem pro-rata from the treasury. Fees are capped and visible before your order lands. Your keys, your payout.",
              accent: "bg-grass",
              number: "03",
            },
          ].map(({ title, body, accent, number }, i) => (
            <div key={i} className="step-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={`w-8 h-8 rounded-[4px] ${accent} flex items-center justify-center font-mono text-[11px] font-bold text-white`}
                >
                  {number}
                </span>
                <h3 className="font-display font-bold text-[17px] text-ink">
                  {title}
                </h3>
              </div>
              <p className="text-[14px] text-ink-soft leading-relaxed pl-11">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
