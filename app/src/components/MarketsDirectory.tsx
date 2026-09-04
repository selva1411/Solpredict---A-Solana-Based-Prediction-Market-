"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X, Flame } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import type { UiMarket } from "@/lib/market-adapter";
import type { MarketCacheEntry } from "@/lib/db/markets-store";
import { MarketCardSkeleton, EmptyState } from "@/components/StatePanels";
import { LabelLux } from "@/components/ui/label-lux";
import { MarketCard } from "@/components/MarketCard";

const CATEGORIES = [
  "All",
  "Crypto",
  "Sports",
  "Politics",
  "Tech",
  "Other",
] as const;

const CATEGORY_BLOCK: Record<string, string> = {
  All: "bg-ink-fill text-white",
  Crypto: "bg-cyan text-ink-static",
  Sports: "bg-grass text-ink-static",
  Politics: "bg-magenta text-white dark:text-ink-static",
  Tech: "bg-yellow text-ink-static",
  Other: "bg-sheet text-ink border border-hairline",
};

const SORT_OPTIONS = [
  { key: "liquidity", label: "Volume" },
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending Soon" },
  { key: "probability", label: "Probability" },
  { key: "trending", label: "Trending" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

/** Newest view only includes markets created within this window. */
const NEWEST_CUTOFF_MS = 3 * 24 * 60 * 60 * 1000;

const PROB_RANGES = [
  { key: "all", label: "Any %", min: 0, max: 100 },
  { key: "0-20", label: "0–20%", min: 0, max: 20 },
  { key: "21-40", label: "21–40%", min: 20, max: 40 },
  { key: "41-60", label: "41–60%", min: 40, max: 60 },
  { key: "61-80", label: "61–80%", min: 60, max: 80 },
  { key: "81-100", label: "81–100%", min: 80, max: 100 },
] as const;

export default function MarketsDirectory({
  initialMarkets,
}: {
  initialMarkets: MarketCacheEntry[];
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] =
    useState<(typeof CATEGORIES)[number]>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("liquidity");
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [showFilters, setShowFilters] = useState(false);
  const [probRange, setProbRange] =
    useState<(typeof PROB_RANGES)[number]["key"]>("all");

  const { markets: onChainMarkets, loading } = useMarkets(
    10_000,
    initialMarkets
  );

  const markets: UiMarket[] = useMemo(
    () => onChainMarketsToUi(onChainMarkets ?? []),
    [onChainMarkets]
  );

  const filtered = useMemo(() => {
    let list = markets.filter((m) =>
      status === "open"
        ? m.status !== "settled" && m.status !== "cancelled"
        : m.status === "settled"
    );
    if (activeCategory !== "All") {
      list = list.filter((m) => m.category === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.question.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }
    const pr = PROB_RANGES.find((r) => r.key === probRange)!;
    if (pr.key !== "all") {
      const yesPct = (m: UiMarket) => m.yesPrice * 100;
      list = list.filter((m) => yesPct(m) >= pr.min && yesPct(m) <= pr.max);
    }
    if (sortBy === "liquidity") {
      list = [...list].sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
    } else if (sortBy === "newest") {
      const cutoff = Date.now() - NEWEST_CUTOFF_MS;
      list = list
        .filter((m) => {
          const t = m.createdAt ? new Date(m.createdAt).getTime() : NaN;
          return !Number.isNaN(t) && t >= cutoff;
        })
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
          if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta;
          if (!Number.isNaN(ta)) return -1;
          if (!Number.isNaN(tb)) return 1;
          return (b.marketId || 0) - (a.marketId || 0);
        });
    } else if (sortBy === "ending") {
      list = [...list].sort(
        (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
      );
    } else if (sortBy === "probability") {
      list = [...list].sort((a, b) => b.yesPrice - a.yesPrice);
    } else if (sortBy === "trending") {
      list = [...list].sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
    }
    return list;
  }, [markets, activeCategory, search, sortBy, status, probRange]);

  const activeFilters = [
    activeCategory !== "All" ? activeCategory : null,
    status === "resolved" ? "Resolved" : null,
    probRange !== "all"
      ? PROB_RANGES.find((r) => r.key === probRange)!.label
      : null,
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8 rise">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 bg-cyan rounded-[1px]" />
            <LabelLux className="mb-0 text-ash">Markets</LabelLux>
          </div>
          <span className="hidden md:inline flex items-center gap-1.5 font-mono text-[10px] text-ash-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
            {filtered.length} shown
          </span>
        </div>
        <h1 className="font-display text-[34px] font-black tracking-tight text-ink mb-4">
          Browse markets
        </h1>

        {/* Search + sort */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 md:max-w-md flex items-center gap-2.5 px-3.5 h-10 rounded-[8px] bg-cream border border-hairline shadow-panel transition-all focus-within:border-ink focus-within:shadow-lift">
            <Search className="w-4 h-4 text-ash-dim shrink-0" />
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ash-dim focus:outline-none"
              aria-label="Search markets"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-ash-dim hover:text-ink cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-[8px] bg-cream border border-hairline shadow-panel overflow-x-auto no-scrollbar">
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                aria-pressed={sortBy === key}
                className={`snap shrink-0 px-3 h-8 rounded-[4px] text-[11px] font-bold transition-all cursor-pointer ${
                  sortBy === key
                    ? "bg-ink-fill text-white shadow-sm"
                    : "text-ash hover:text-ink hover:bg-sheet"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className={`snap flex items-center gap-2 px-3.5 h-10 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer border-2 ${
              showFilters || activeFilters.length > 0
                ? "border-cyan bg-cyan/10 text-inkblue"
                : "border-hairline text-ash hover:border-ink hover:text-ink"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilters.length > 0 && (
              <span className="num text-[10px] text-inkblue">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 mt-4 p-1 w-fit rounded-[8px] bg-cream border border-hairline shadow-panel">
          {(["open", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`snap px-4 h-8 rounded-[4px] text-[11px] font-bold transition-all cursor-pointer ${
                status === s
                  ? "bg-ink-fill text-white shadow-sm"
                  : "text-ash hover:text-ink hover:bg-sheet"
              }`}
            >
              {s === "open" ? "Open" : "Resolved"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Categories sidebar */}
        <aside className="lg:w-44 shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-5 bg-magenta rounded-[1px]" />
            <LabelLux className="mb-0 text-ash">Categories</LabelLux>
          </div>
          <nav
            className="flex flex-wrap lg:flex-col gap-1.5 lg:sticky lg:top-20"
            aria-label="Categories"
          >
            {CATEGORIES.map((cat) => {
              const count =
                cat === "All"
                  ? markets.length
                  : markets.filter((m) => m.category === cat).length;
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  aria-pressed={active}
                  className={`snap flex items-center justify-between gap-3 px-3 h-9 rounded-[4px] text-[13px] font-medium transition-all cursor-pointer ${
                    active
                      ? `${CATEGORY_BLOCK[cat]} shadow-sm`
                      : "text-ash hover:text-ink hover:bg-sheet border border-transparent"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`num text-[11px] ${
                      active ? "opacity-60" : "text-ash-dim"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Market grid */}
        <section className="flex-1 min-w-0">
          {/* Mobile category chips */}
          <div className="lg:hidden flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`snap shrink-0 px-3 h-8 rounded-[4px] text-[12px] transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? CATEGORY_BLOCK[cat] + " border border-ink"
                    : "text-ash border border-hairline bg-cream"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Filter dropdown */}
          {showFilters && (
            <div className="mb-4 surface-feature p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-5 bg-yellow rounded-[1px]" />
                  <LabelLux className="mb-0 text-ash">YES probability</LabelLux>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PROB_RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setProbRange(r.key)}
                      className={`snap px-3 h-8 rounded-[4px] text-[11px] transition-colors cursor-pointer ${
                        probRange === r.key
                          ? "bg-ink-fill text-white"
                          : "text-ash border border-hairline bg-cream hover:text-ink"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilters.length > 0 && (
                <button
                  onClick={() => {
                    setActiveCategory("All");
                    setStatus("open");
                    setProbRange("all");
                  }}
                  className="snap flex items-center gap-1.5 text-[11px] font-mono text-inkblue hover:underline"
                >
                  <X className="w-3 h-3" /> Clear all filters
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <MarketCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="No markets found"
              description={
                search
                  ? `No markets match "${search}".`
                  : "No prediction markets match your current filters. Try broadening your search."
              }
              action={{
                label: "Clear filters",
                onClick: () => {
                  setSearch("");
                  setActiveCategory("All");
                  setProbRange("all");
                  setStatus("open");
                },
              }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((m, i) => (
                <MarketCard
                  key={m.id}
                  market={m}
                  index={i}
                  onClick={() => router.push(`/market/${m.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
