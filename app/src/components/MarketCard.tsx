"use client";

import React, { memo, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Star, BarChart2, ArrowUpRight } from "lucide-react";
import { useAppState } from "@/contexts/AppContext";
import type { UiMarket } from "@/lib/market-adapter";
import { TimeLeft } from "@/components/ui/time-left";

interface MarketCardProps {
  market: UiMarket;
  index?: number;
  onClick?: () => void;
  selected?: boolean;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (v > 0) return `${v.toFixed(1)}`;
  return `0`;
}

function CreatedLabel({ createdAt }: { createdAt?: string }) {
  const [label, setLabel] = useState<string>("");
  useEffect(() => {
    if (!createdAt) return;
    const t = new Date(createdAt).getTime();
    if (Number.isNaN(t)) return;
    const compute = () => {
      const secs = Math.floor((Date.now() - t) / 1000);
      if (secs < 60) return "just now";
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    };
    setLabel(compute());
    const iv = setInterval(() => setLabel(compute()), 60_000);
    return () => clearInterval(iv);
  }, [createdAt]);
  if (!label) return null;
  return <span className="text-[11px] text-[#4A5158] dark:text-[#68707B] font-mono">{label}</span>;
}

export const MarketCard = memo(function MarketCard({
  market,
  index = 0,
  onClick,
  selected,
}: MarketCardProps) {
  const yesPct = Math.round(market.yesPrice * 100);
  const noPct = 100 - yesPct;
  const yesLabel = market.yesLabel || market.outcomes?.[0]?.label || "YES";
  const noLabel = market.noLabel || market.outcomes?.[1]?.label || "NO";
  const { isWatched, toggleWatchlistItem } = useAppState();
  const watched = isWatched(market.id);

  const handleStarClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleWatchlistItem(market.id);
    },
    [market.id, toggleWatchlistItem]
  );

  const settled = market.status === "settled";
  const cancelled = market.status === "cancelled";
  const totalVol = market.totalVolume || market.volume24h || market.liquidity || 0;

  // Displayed probability — locked at 50/50 for settled/cancelled
  const displayYesPct = settled || cancelled ? 50 : yesPct;
  const displayNoPct  = settled || cancelled ? 50 : noPct;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, delay: Math.min(index * 0.015, 0.15) }}
      onClick={onClick}
      className={`group relative cursor-pointer flex flex-col justify-between rounded-[3px] p-4 bg-white dark:bg-[#1A1D21] border transition-colors duration-150 select-none ${
        selected
          ? "border-[#1F3A52] dark:border-[#7A9BB5] ring-1 ring-[#1F3A52] dark:ring-[#7A9BB5]"
          : "border-[#E2DFD7] dark:border-[#2A2F36] hover:border-[#B8B4A8] dark:hover:border-[#3E4550]"
      }`}
    >
      <div>
        {/* Top bar: Category badge + Expiry badge + Star */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2E353F]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1F3A52] dark:bg-[#7A9BB5] flex-shrink-0" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#0A0B0D] dark:text-[#9AA1AA] font-bold">
              {market.category}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#2D3136] dark:text-[#68707B] flex items-center gap-1">
              {settled ? (
                <span className="px-1.5 py-0.5 rounded-[2px] bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2A2F36] text-[#0A0B0D] dark:text-[#9AA1AA] font-mono font-medium text-[10px]">
                  Settled
                </span>
              ) : cancelled ? (
                <span className="px-1.5 py-0.5 rounded-[2px] bg-[#FBF1F0] dark:bg-[#2A1E1E] border border-[#ECCDC9] dark:border-[#B43C34]/30 text-[#8E261F] dark:text-[#E57373] font-mono font-medium text-[10px]">
                  Cancelled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#2D3136] dark:text-[#68707B]">
                  <Clock className="w-3 h-3 text-[#2D3136] dark:text-[#68707B]" />
                  <TimeLeft endDate={market.endDate} />
                </span>
              )}
            </span>

            <button
              onClick={handleStarClick}
              className="p-1 rounded-[2px] text-[#2D3136] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3] hover:bg-[#F1EFEA] dark:hover:bg-[#21252A] transition-colors cursor-pointer"
              aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star
                className={`w-3.5 h-3.5 transition-colors ${
                  watched ? "fill-[#1F3A52] text-[#1F3A52] dark:fill-[#7A9BB5] dark:text-[#7A9BB5]" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Market Question */}
        <h3 className="font-sans font-semibold text-[14px] sm:text-[15px] leading-[1.35] text-[#0A0B0D] dark:text-[#EAE8E3] group-hover:text-[#1F3A52] dark:group-hover:text-[#7A9BB5] transition-colors line-clamp-2 min-h-[42px] mb-3">
          {market.question}
        </h3>

        {/* Probability Dual Progress Rule */}
        <div className="mb-2.5">
          <div className="h-1 w-full rounded-[1px] overflow-hidden bg-[#E2DFD7] dark:bg-[#2A2F36] flex">
            <div
              className="h-full transition-all duration-300 bg-[#1D7C59]"
              style={{ width: `${displayYesPct}%` }}
            />
            <div
              className="h-full transition-all duration-300 bg-[#B43C34]"
              style={{ width: `${displayNoPct}%` }}
            />
          </div>
        </div>

        {/* ── FLAT OUTCOME TILES (Editorial / Financial style) ── */}
        <div className="grid grid-cols-2 gap-2 mb-3.5">
          {/* YES Tile */}
          <div className="rounded-[3px] p-2 bg-[#EDF6F1] dark:bg-[rgba(29,124,89,0.12)] border border-[#BCDDCF] dark:border-[#1D7C59]/30 transition-colors flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="font-semibold text-[#0F5A3E] dark:text-[#52B788] uppercase tracking-wider">{yesLabel}</span>
              <span className="text-[10px] text-[#0F5A3E] dark:text-[#52B788]/80 font-mono font-medium">
                {!settled && !cancelled && `${(market.yesPrice).toFixed(2)} SOL`}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between font-mono">
              <span className="text-[17px] font-bold text-[#0F5A3E] dark:text-[#52B788] tabular-nums leading-none">
                {settled || cancelled ? "—" : `${displayYesPct}%`}
              </span>
              <span className="text-[10px] text-[#0F5A3E] dark:text-[#52B788]/80 font-mono font-medium">
                {!settled && !cancelled && `${displayYesPct}¢`}
              </span>
            </div>
          </div>

          {/* NO Tile */}
          <div className="rounded-[3px] p-2 bg-[#FBF1F0] dark:bg-[rgba(180,60,52,0.12)] border border-[#ECCDC9] dark:border-[#B43C34]/30 transition-colors flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="font-semibold text-[#8E261F] dark:text-[#E57373] uppercase tracking-wider">{noLabel}</span>
              <span className="text-[10px] text-[#8E261F] dark:text-[#E57373]/80 font-mono font-medium">
                {!settled && !cancelled && `${(market.noPrice).toFixed(2)} SOL`}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between font-mono">
              <span className="text-[17px] font-bold text-[#8E261F] dark:text-[#E57373] tabular-nums leading-none">
                {settled || cancelled ? "—" : `${displayNoPct}%`}
              </span>
              <span className="text-[10px] text-[#8E261F] dark:text-[#E57373]/80 font-mono font-medium">
                {!settled && !cancelled && `${displayNoPct}¢`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Volume + Timestamp + Trade Action */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#E2DFD7] dark:border-[#2A2F36] font-mono text-[11px] text-[#2D3136] dark:text-[#68707B]">
        <span className="flex items-center gap-1.5 font-medium text-[#0A0B0D] dark:text-[#9AA1AA]">
          <BarChart2 className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
          {formatVolume(totalVol)} SOL Vol
        </span>
        <div className="flex items-center gap-2 text-[#2D3136]">
          <CreatedLabel createdAt={market.createdAt} />
          <span className="inline-flex items-center gap-0.5 text-[11px] font-mono font-medium text-[#1F3A52] dark:text-[#7A9BB5] opacity-0 group-hover:opacity-100 transition-opacity">
            Trade <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </motion.div>
  );
});
