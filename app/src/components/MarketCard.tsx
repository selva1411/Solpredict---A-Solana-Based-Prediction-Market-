"use client";

import React, { memo, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Star } from "lucide-react";
import { useAppState } from "@/contexts/AppContext";
import type { UiMarket } from "@/lib/market-adapter";
import { FlashValue } from "@/components/ui/flash-value";
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

const CATEGORY_BLOCK: Record<string, string> = {
  Crypto: "bg-cyan text-ink-static",
  Sports: "bg-grass text-ink-static",
  Politics: "bg-magenta text-white dark:text-ink-static",
  Tech: "bg-yellow text-ink-static",
  Other: "bg-sheet text-ink border border-hairline",
};

/** "created X ago" label, hydration-safe by construction (renders after mount). */
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
      if (days < 30) return `${days}d ago`;
      return new Date(t).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };
    setLabel(compute());
    const iv = setInterval(() => setLabel(compute()), 60_000);
    return () => clearInterval(iv);
  }, [createdAt]);
  if (!label) return null;
  return <span className="font-mono text-[10px] text-ash">{label}</span>;
}

export const MarketCard = memo(function MarketCard({
  market,
  index = 0,
  onClick,
  selected,
}: MarketCardProps) {
  const yesPct = Math.round(market.yesPrice * 100);
  const noPct = 100 - yesPct;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.2) }}
      onClick={onClick}
      className={`group relative cursor-pointer flex flex-col transition-all duration-200 overflow-hidden surface card-hover-glow ${
        selected ? "ring-3 ring-ink" : ""
      }`}
      style={{ borderRadius: "var(--radius-panel)" }}
    >
      {/* CMYK top signal — the accent that owns the card */}
      <div className="h-1 w-full flex -mt-0.5">
        <span
          className={`flex-1 transition-all duration-300 ${
            CATEGORY_BLOCK[market.category]?.split(" ")[0] ?? "bg-sheet"
          }`}
        />
        <span className="flex-1 bg-sheet" />
        <span className="flex-1 bg-sheet" />
      </div>
      <div className="p-4 flex flex-col gap-3">
        {/* Header: category + time */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`px-2 py-0.5 rounded-[3px] font-mono text-[9px] font-bold uppercase tracking-wider ${
              CATEGORY_BLOCK[market.category] ?? CATEGORY_BLOCK.Other
            }`}
          >
            {market.category}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStarClick}
              className="p-0.5 rounded hover:bg-sheet transition-colors cursor-pointer"
              aria-label={
                watched ? "Remove from watchlist" : "Add to watchlist"
              }
            >
              <Star
                className={`w-3 h-3 transition-all duration-200 ${
                  watched
                    ? "fill-yellow text-ink scale-110"
                    : "text-ash hover:text-ink"
                }`}
              />
            </button>
            <span className="font-mono text-[10px] text-ash flex items-center gap-1">
              {settled ? (
                "Settled"
              ) : cancelled ? (
                "Cancelled"
              ) : (
                <>
                  <Clock className="w-2.5 h-2.5" />
                  <TimeLeft endDate={market.endDate} />
                </>
              )}
            </span>
          </div>
        </div>

        {/* Question */}
        <h3 className="font-display font-bold text-[15px] leading-snug line-clamp-2 text-ink group-hover:text-magenta transition-colors duration-200">
          {market.question}
        </h3>

        {/* Probability bar — refined */}
        <div className="probability-bar" aria-hidden>
          <div
            className={`probability-fill ${
              settled || cancelled ? "bg-hairline" : "bg-yes"
            }`}
            style={{ width: `${settled || cancelled ? 50 : yesPct}%` }}
          />
        </div>

        {/* Prices — YES solid block / NO outline block */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className={`flex items-baseline justify-between gap-2 rounded-[4px] px-3 py-2.5 transition-all duration-200 ${
              settled || cancelled
                ? "bg-sheet border border-hairline"
                : "bg-yes-fill border-2 border-ink"
            }`}
          >
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink/70">
              YES
            </span>
            {settled || cancelled ? (
              <span className="num font-display font-extrabold text-[20px] text-ash tabular-nums">
                --
              </span>
            ) : (
              <FlashValue
                value={yesPct}
                decimals={0}
                suffix="¢"
                className="num font-display font-extrabold text-[20px] text-ink tabular-nums"
              />
            )}
          </div>
          <div className="flex items-baseline justify-between gap-2 rounded-[4px] px-3 py-2.5 border-2 border-no bg-cream transition-all duration-200">
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink/70">
              NO
            </span>
            {settled || cancelled ? (
              <span className="num font-display font-extrabold text-[20px] text-ash tabular-nums">
                --
              </span>
            ) : (
              <FlashValue
                value={noPct}
                decimals={0}
                suffix="¢"
                className="num font-display font-extrabold text-[20px] text-ink tabular-nums"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-hairline">
          <span className="font-mono text-[10px] text-ash-dim">
            {formatVolume(market.volume24h || market.liquidity)} SOL vol
          </span>
          <span className="font-mono text-[10px] text-ash-dim">
            <CreatedLabel createdAt={market.createdAt} />
          </span>
        </div>
      </div>
    </motion.div>
  );
});
