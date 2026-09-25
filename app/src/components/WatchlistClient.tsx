"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, ArrowUpRight, Search, Compass, SlidersHorizontal } from "lucide-react";
import { useMarkets, dbRowToMarketAccount } from "@/hooks/useMarkets";
import { onChainMarketsToUi, onChainToUiMarket, type UiMarket } from "@/lib/market-adapter";
import { ENV } from "@/lib/env";
import { useAppState } from "@/contexts/AppContext";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/StatePanels";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

export default function WatchlistClient({
  initialMarkets,
}: {
  initialMarkets: MarketCacheEntry[];
}) {
  const router = useRouter();
  const { watchlist } = useAppState();
  const { markets: onChainMarkets, loading } = useMarkets(10_000, initialMarkets, {
    status: "all",
  });

  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "settled">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [extraMarkets, setExtraMarkets] = useState<UiMarket[]>([]);

  const uiMarkets: UiMarket[] = useMemo(
    () => onChainMarketsToUi(onChainMarkets ?? []),
    [onChainMarkets]
  );

  // Check if any keys in watchlist are missing from uiMarkets
  const missingKeys = useMemo(() => {
    const existing = new Set<string>();
    for (const m of uiMarkets) {
      existing.add(m.id);
      existing.add(String(m.marketId));
    }
    for (const m of extraMarkets) {
      existing.add(m.id);
      existing.add(String(m.marketId));
    }
    return watchlist.filter((k) => !existing.has(k));
  }, [uiMarkets, extraMarkets, watchlist]);

  // Fetch any missing watched markets individually by key
  useEffect(() => {
    if (missingKeys.length === 0) return;
    let cancelled = false;
    Promise.all(
      missingKeys.map(async (k) => {
        try {
          const res = await fetch(`/api/markets/${k}`);
          const data = await res.json();
          if (data.ok && data.market) {
            return onChainToUiMarket(
              dbRowToMarketAccount(data.market, ENV.programId)
            );
          }
        } catch {}
        return null;
      })
    ).then((results) => {
      if (cancelled) return;
      const valid = results.filter((m): m is UiMarket => m !== null);
      if (valid.length > 0) {
        setExtraMarkets((prev) => {
          const map = new Map<string, UiMarket>();
          for (const m of prev) map.set(m.id, m);
          for (const m of valid) map.set(m.id, m);
          return Array.from(map.values());
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [missingKeys]);

  const allAvailableMarkets = useMemo(() => {
    if (extraMarkets.length === 0) return uiMarkets;
    const map = new Map<string, UiMarket>();
    for (const m of uiMarkets) map.set(m.id, m);
    for (const m of extraMarkets) map.set(m.id, m);
    return Array.from(map.values());
  }, [uiMarkets, extraMarkets]);

  // Filter to watched markets
  const watchedMarkets: UiMarket[] = useMemo(() => {
    return allAvailableMarkets.filter(
      (m) => watchlist.includes(m.id) || watchlist.includes(String(m.marketId))
    );
  }, [allAvailableMarkets, watchlist]);

  // Apply status and search filters
  const filteredMarkets = useMemo(() => {
    let list = watchedMarkets;
    if (filterStatus === "open") {
      list = list.filter((m) => m.status === "open");
    } else if (filterStatus === "settled") {
      list = list.filter((m) => m.status === "settled" || m.status === "cancelled");
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
  }, [watchedMarkets, filterStatus, searchQuery]);

  const openCount = useMemo(
    () => watchedMarkets.filter((m) => m.status === "open").length,
    [watchedMarkets]
  );
  const settledCount = useMemo(
    () =>
      watchedMarkets.filter((m) => m.status === "settled" || m.status === "cancelled")
        .length,
    [watchedMarkets]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-ground,#F8F7F4)] text-[var(--color-ink,#181A1C)] transition-colors">
      <main className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-8 sm:py-10 flex-1">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2DFD7] dark:border-[#2A2F36] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[3px] bg-[#F1EFEA] dark:bg-[#1F2329] border border-[#E2DFD7] dark:border-[#2E353F] mb-3">
              <Star className="w-3.5 h-3.5 fill-[#1F3A52] text-[#1F3A52] dark:fill-[#7A9BB5] dark:text-[#7A9BB5]" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#555D65] dark:text-[#9AA1AA]">
                Personal Watchlist
              </span>
            </div>
            <h1
              className="text-[32px] sm:text-[40px] font-bold tracking-tight text-[#181A1C] dark:text-[#EAE8E3] leading-[1.1]"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              Watched Markets
            </h1>
            <p className="text-[13px] text-[#555D65] dark:text-[#9AA1AA] mt-1.5 font-sans">
              {watchedMarkets.length > 0
                ? `Tracking ${watchedMarkets.length} market${
                    watchedMarkets.length !== 1 ? "s" : ""
                  } with real-time odds, volume and resolution countdowns.`
                : "Bookmark prediction markets to monitor live odds, volume and resolution countdowns."}
            </p>
          </div>

          {watchedMarkets.length > 0 && (
            <div className="flex items-center gap-2 self-start md:self-auto">
              <Link
                href="/markets"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[3px] bg-white dark:bg-[#1E2227] border border-[#E2DFD7] dark:border-[#2E353F] text-[12px] font-semibold text-[#181A1C] dark:text-[#EAE8E3] hover:border-[#1F3A52] dark:hover:border-[#7A9BB5] transition-colors shadow-xs"
              >
                <Compass className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
                Browse More Markets
              </Link>
            </div>
          )}
        </div>

        {/* Content */}
        {loading && watchedMarkets.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <MarketCardSkeleton key={i} />
            ))}
          </div>
        ) : watchedMarkets.length === 0 ? (
          /* Empty State */
          <div className="rounded-[4px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#16181C] p-12 sm:p-16 text-center shadow-xs">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2E353F] mb-5 text-[#1F3A52] dark:text-[#7A9BB5]">
              <Star className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h2
              className="text-[20px] sm:text-[22px] font-bold text-[#181A1C] dark:text-[#EAE8E3] mb-2"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              Your Watchlist is Empty
            </h2>
            <p className="text-[13px] text-[#555D65] dark:text-[#9AA1AA] max-w-md mx-auto mb-6">
              Click the star icon on any market card or detail page to pin it here for instant monitoring and quick trading access.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/markets"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[3px] bg-[#1F3A52] dark:bg-[#7A9BB5] text-white dark:text-[#0A0B0D] text-[13px] font-semibold hover:bg-[#162B3D] dark:hover:bg-[#96B5CF] transition-colors shadow-xs"
              >
                Explore Markets <ArrowUpRight className="w-4 h-4" />
              </Link>
              <ClientWalletButton />
            </div>
          </div>
        ) : (
          <div>
            {/* Filter toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
              <div className="inline-flex items-center gap-1 p-1 rounded-[3px] bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2E353F] self-start">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-3 py-1 rounded-[2px] text-[12px] font-mono font-medium transition-colors cursor-pointer ${
                    filterStatus === "all"
                      ? "bg-white dark:bg-[#16181C] text-[#181A1C] dark:text-[#EAE8E3] shadow-xs"
                      : "text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                  }`}
                >
                  All ({watchedMarkets.length})
                </button>
                <button
                  onClick={() => setFilterStatus("open")}
                  className={`px-3 py-1 rounded-[2px] text-[12px] font-mono font-medium transition-colors cursor-pointer ${
                    filterStatus === "open"
                      ? "bg-white dark:bg-[#16181C] text-[#181A1C] dark:text-[#EAE8E3] shadow-xs"
                      : "text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                  }`}
                >
                  Open ({openCount})
                </button>
                <button
                  onClick={() => setFilterStatus("settled")}
                  className={`px-3 py-1 rounded-[2px] text-[12px] font-mono font-medium transition-colors cursor-pointer ${
                    filterStatus === "settled"
                      ? "bg-white dark:bg-[#16181C] text-[#181A1C] dark:text-[#EAE8E3] shadow-xs"
                      : "text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                  }`}
                >
                  Resolved ({settledCount})
                </button>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#555D65] dark:text-[#9AA1AA]" />
                <input
                  type="text"
                  placeholder="Filter watched markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] font-sans bg-white dark:bg-[#1E2227] border border-[#E2DFD7] dark:border-[#2E353F] rounded-[3px] text-[#181A1C] dark:text-[#EAE8E3] placeholder:text-[#555D65] dark:placeholder:text-[#9AA1AA] focus:outline-none focus:border-[#1F3A52] dark:focus:border-[#7A9BB5]"
                />
              </div>
            </div>

            {/* Grid of Markets */}
            {filteredMarkets.length === 0 ? (
              <div className="rounded-[4px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#16181C] p-8 text-center">
                <p className="text-[13px] text-[#555D65] dark:text-[#9AA1AA]">
                  No watched markets match your filter criteria.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMarkets.map((m, idx) => (
                  <MarketCard
                    key={m.id}
                    market={m}
                    index={idx}
                    onClick={() => router.push(`/market/${m.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
