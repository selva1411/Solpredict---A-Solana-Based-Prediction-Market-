"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  X,
  Flame,
  LayoutList,
  LayoutGrid,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import type { UiMarket } from "@/lib/market-adapter";
import type { MarketCacheEntry } from "@/lib/db/markets-store";
import { MarketCardSkeleton, EmptyState } from "@/components/StatePanels";
import { MarketCard } from "@/components/MarketCard";
import { TimeLeft } from "@/components/ui/time-left";

const CATEGORIES = [
  "All",
  "Crypto",
  "Sports",
  "Politics",
  "Tech",
  "Other",
] as const;

const CATEGORY_DOT: Record<string, string> = {
  Crypto:   "#1F3A52",
  Sports:   "#555D65",
  Politics: "#7F8892",
  Tech:     "#1F3A52",
  Other:    "#7F8892",
};

const SORT_OPTIONS = [
  { key: "liquidity", label: "Volume" },
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending Soon" },
  { key: "probability", label: "Probability" },
  { key: "trending", label: "Trending" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

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
  const [viewMode, setViewMode] = useState<"row" | "card">("card");
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
      list = [...list].sort((a, b) => {
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
    <main className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-6 text-[#0A0B0D] dark:text-[#EAE8E3]">
      <div className="mb-6 flex flex-col gap-4 border-b border-[#E2DFD7] dark:border-[#2A2F36] pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1F3A52] dark:bg-[#7A9BB5]" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#2C3138] dark:text-[#68707B] font-bold">
                Live Exchange Directory
              </span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-[#0A0B0D] dark:text-[#EAE8E3]">
              Prediction Markets
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Status switcher */}
            <div className="flex items-center p-0.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#1A1D21]">
              {(["open", "resolved"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 h-7 rounded-[2px] font-sans text-[11px] font-semibold transition-colors cursor-pointer ${
                    status === s
                      ? "bg-white dark:bg-[#21252A] text-[#0A0B0D] dark:text-[#EAE8E3] shadow-xs"
                      : "text-[#181B1F] dark:text-[#9AA1AA] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3]"
                  }`}
                >
                  {s === "open" ? "Active" : "Settled"}
                </button>
              ))}
            </div>

            {/* Layout Mode (Row vs Card) */}
            <div className="hidden sm:flex items-center p-0.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#1A1D21]">
              <button
                onClick={() => setViewMode("row")}
                className={`p-1.5 rounded-[2px] cursor-pointer transition-colors ${
                  viewMode === "row"
                    ? "bg-white dark:bg-[#21252A] text-[#1F3A52] dark:text-[#7A9BB5] shadow-xs"
                    : "text-[#2C3138] dark:text-[#68707B] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3]"
                }`}
                title="Board Table View"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("card")}
                className={`p-1.5 rounded-[2px] cursor-pointer transition-colors ${
                  viewMode === "card"
                    ? "bg-white dark:bg-[#21252A] text-[#1F3A52] dark:text-[#7A9BB5] shadow-xs"
                    : "text-[#2C3138] dark:text-[#68707B] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3]"
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search + Sort + Filters toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search bar */}
          <div className="flex-1 flex items-center gap-2 px-3 h-9 rounded-[3px] bg-[#FFFFFF] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] focus-within:border-[#1F3A52] dark:focus-within:border-[#7A9BB5]">
            <Search className="w-3.5 h-3.5 text-[#2C3138] dark:text-[#68707B] shrink-0" />
            <input
              type="text"
              placeholder="Search markets by question, ticker or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent font-sans text-[12px] text-[#0A0B0D] dark:text-[#EAE8E3] placeholder-[#4A5158] dark:placeholder-[#68707B] focus:outline-none"
              aria-label="Search markets"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-[#2C3138] hover:text-[#0A0B0D] dark:text-[#68707B] dark:hover:text-[#EAE8E3] cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-1 p-0.5 rounded-[3px] bg-[#F1EFEA] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] overflow-x-auto no-scrollbar">
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`shrink-0 px-2.5 h-7 rounded-[2px] font-sans text-[11px] font-semibold transition-colors cursor-pointer ${
                  sortBy === key
                    ? "bg-white dark:bg-[#21252A] text-[#1F3A52] dark:text-[#7A9BB5] shadow-xs font-semibold"
                    : "text-[#181B1F] dark:text-[#9AA1AA] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 h-9 rounded-[3px] font-sans text-[12px] font-semibold transition-colors cursor-pointer border ${
              showFilters || activeFilters.length > 0
                ? "border-[#1F3A52] bg-[#F1EFEA] dark:bg-[#21252A] text-[#1F3A52] dark:text-[#7A9BB5] dark:border-[#7A9BB5]"
                : "border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181B1F] dark:text-[#9AA1AA] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3]"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilters.length > 0 && (
              <span className="text-[10px] text-[#1F3A52] dark:text-[#7A9BB5] font-semibold">
                ({activeFilters.length})
              </span>
            )}
          </button>
        </div>

        {/* Extended filters drawer */}
        {showFilters && (
          <div className="p-3.5 rounded-[3px] bg-[#FFFFFF] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] space-y-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#2C3138] dark:text-[#68707B] mb-2 font-semibold">
                Probability band (YES)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PROB_RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setProbRange(r.key)}
                    className={`px-2.5 h-6 rounded-[2px] font-sans text-[10px] font-semibold transition-colors cursor-pointer border ${
                      probRange === r.key
                        ? "border-[#1F3A52] dark:border-[#7A9BB5] bg-[#1F3A52] dark:bg-[#7A9BB5] text-white"
                        : "border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#21252A] text-[#181B1F] dark:text-[#9AA1AA] hover:text-[#0D0F11] dark:hover:text-[#EAE8E3]"
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
                  setSearch("");
                }}
                className="flex items-center gap-1.5 font-sans text-[10px] text-[#B43C34] hover:underline cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Reset all filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Categories sidebar */}
        <aside className="lg:w-44 shrink-0">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#2C3138] dark:text-[#68707B] mb-2 font-bold">
            Categories
          </div>
          <nav
            className="flex flex-wrap lg:flex-col gap-1 lg:sticky lg:top-20"
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
                  className={`flex items-center justify-between px-3 h-8 rounded-[3px] font-sans text-[12px] font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-[#F1EFEA] dark:bg-[#21252A] text-[#1F3A52] dark:text-[#7A9BB5] border-l-2 border-[#1F3A52] dark:border-[#7A9BB5]"
                      : "text-[#181B1F] dark:text-[#9AA1AA] hover:text-[#0D0F11] dark:hover:text-[#EAE8E3] hover:bg-[#F1EFEA] dark:hover:bg-[#21252A]"
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-[10px] font-mono text-[#2C3138] dark:text-[#68707B] tabular-nums font-semibold">
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Directory Content */}
        <section className="flex-1 min-w-0">
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
                  ? `No lines match "${search}".`
                  : "No prediction markets match your current filters. Broaden your search."
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
          ) : viewMode === "row" ? (
            /* ── EXCHANGE BOARD (TABLE VIEW) ── */
            <div className="rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#E2DFD7] dark:border-[#2A2F36] text-[10px] font-mono uppercase tracking-wider text-[#22262A] dark:text-[#9AA1AA] font-bold bg-[#F8F7F4] dark:bg-[#16181C]">
                      <th className="py-3 px-4">Market</th>
                      <th className="py-3 px-4 w-44">Odds Spread</th>
                      <th className="py-3 px-4 text-right">YES</th>
                      <th className="py-3 px-4 text-right">NO</th>
                      <th className="py-3 px-4 text-right">24h Vol</th>
                      <th className="py-3 px-4 text-right">Expiry</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DFD7] dark:divide-[#2A2F36]">
                    {filtered.map((m) => {
                      const yesPct = Math.round(m.yesPrice * 100);
                      const noPct = 100 - yesPct;
                      const settled = m.status === "settled";
                      const cancelled = m.status === "cancelled";
                      const totalVol = m.totalVolume || m.volume24h || m.liquidity || 0;
                      const dotColor = CATEGORY_DOT[m.category] ?? CATEGORY_DOT.Other;
                      return (
                        <tr
                          key={m.id}
                          onClick={() => router.push(`/market/${m.id}`)}
                          className="hover:bg-[#F8F7F4] dark:hover:bg-[#21252A] transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: dotColor }}
                              />
                              <span className="text-[10px] font-mono font-medium text-[#22262A] dark:text-[#9AA1AA]">
                                {m.category}
                              </span>
                            </div>
                            <div className="font-sans font-semibold text-[13px] text-[#0A0B0D] dark:text-[#EAE8E3] group-hover:text-[#1F3A52] dark:group-hover:text-[#7A9BB5] transition-colors line-clamp-1">
                              {m.question}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="h-[3px] w-full bg-[#E2DFD7] dark:bg-[#2A2F36] rounded-[1px] overflow-hidden flex mb-1.5">
                              <div
                                className="bg-[#1D7C59]"
                                style={{ width: `${settled || cancelled ? 50 : yesPct}%` }}
                              />
                              <div
                                className="bg-[#B43C34]"
                                style={{ width: `${settled || cancelled ? 50 : noPct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] font-mono tabular-nums font-semibold">
                              <span className="text-[#1D7C59] dark:text-[#52B788]">
                                {settled || cancelled ? "—" : `${yesPct}%`}
                              </span>
                              <span className="text-[#B43C34] dark:text-[#E57373]">
                                {settled || cancelled ? "—" : `${noPct}%`}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[12px] font-semibold tabular-nums text-[#1D7C59] dark:text-[#52B788]">
                            {settled || cancelled ? "—" : `${yesPct}¢`}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[12px] font-semibold tabular-nums text-[#B43C34] dark:text-[#E57373]">
                            {settled || cancelled ? "—" : `${noPct}¢`}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[12px] font-medium tabular-nums text-[#0A0B0D] dark:text-[#EAE8E3]">
                            {totalVol >= 1000
                              ? `${(totalVol / 1000).toFixed(1)}k`
                              : totalVol.toFixed(1)}{" "}
                            <span className="text-[#22262A] dark:text-[#9AA1AA] text-[10px] font-mono">SOL</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[11px] text-[#22262A] dark:text-[#9AA1AA]">
                            {settled ? (
                              <span className="text-[#0A0B0D] dark:text-[#EAE8E3] font-medium">Settled</span>
                            ) : cancelled ? (
                              <span className="text-[#B43C34] dark:text-[#E57373] font-medium">Cancelled</span>
                            ) : (
                              <TimeLeft endDate={m.endDate} />
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-[#F1EFEA] dark:bg-[#21252A] group-hover:bg-[#1F3A52] text-[#0A0B0D] dark:text-[#EAE8E3] group-hover:text-white font-sans text-[11px] font-semibold transition-colors">
                              Trade <ArrowRight className="w-3 h-3" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── CARD GRID VIEW ── */
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
