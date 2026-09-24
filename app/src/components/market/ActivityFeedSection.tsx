"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Activity, ExternalLink, Filter, TrendingUp, TrendingDown, Waves, ArrowUpRight } from "lucide-react";
import { EmptyState, LiveIndicator } from "@/components/StatePanels";
import { shortAddr } from "@/lib/format";

export interface ActivityItem {
  signature: string;
  slot: number;
  buyer: string;
  side: "YES" | "NO" | "SETTLE" | "CLAIM" | string;
  quantity: number;
  cost: number;
  time: string;
}

interface ActivityFeedSectionProps {
  activity: ActivityItem[];
  marketPubkey?: string;
  yesLabel?: string;
  noLabel?: string;
}

export function ActivityFeedSection({
  activity,
  marketPubkey,
  yesLabel = "YES",
  noLabel = "NO",
}: ActivityFeedSectionProps) {
  const [filter, setFilter] = useState<"all" | "yes" | "no" | "whale">("all");
  const [dbTrades, setDbTrades] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch verified trades recorded specifically for this market
  useEffect(() => {
    if (!marketPubkey) return;
    let mounted = true;

    async function loadMarketTrades() {
      try {
        setLoading(true);
        const res = await fetch(`/api/activity/recent?marketPubkey=${marketPubkey}&limit=60`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data.ok && Array.isArray(data.activities)) {
          const mapped: ActivityItem[] = data.activities.map((a: any) => ({
            signature: a.signature,
            slot: 0,
            buyer: a.trader,
            side: a.side || "YES",
            quantity: Math.round((a.tokensOut || 0) / 1e6) || 1,
            cost: (a.lamportsIn || 0) / 1e9,
            time: a.blockTime ? new Date(a.blockTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "just now",
          }));
          setDbTrades(mapped);
        }
      } catch (err) {
        console.warn("Failed loading market trades:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadMarketTrades();
    const timer = setInterval(loadMarketTrades, 12_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [marketPubkey]);

  // Merge real-time on-chain decoded logs with persisted DB trades (deduped by signature)
  const allItems = useMemo(() => {
    const map = new Map<string, ActivityItem>();
    // Add DB trades first
    for (const item of dbTrades) {
      map.set(item.signature, item);
    }
    // Prepend / update with on-chain stream
    for (const item of activity) {
      map.set(item.signature, item);
    }
    return Array.from(map.values());
  }, [activity, dbTrades]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const s = String(item.side).toUpperCase();
      if (filter === "yes") return s === "YES";
      if (filter === "no") return s === "NO";
      if (filter === "whale") return item.cost >= 1.0;
      return true;
    });
  }, [allItems, filter]);

  // Analytics summary for this market
  const stats = useMemo(() => {
    let yesVol = 0;
    let noVol = 0;
    let totalCount = allItems.length;

    for (const item of allItems) {
      const s = String(item.side).toUpperCase();
      if (s === "YES") yesVol += item.cost;
      if (s === "NO") noVol += item.cost;
    }

    const totalVol = yesVol + noVol;
    const yesPct = totalVol > 0 ? Math.round((yesVol / totalVol) * 100) : 50;

    return {
      totalCount,
      totalVol,
      yesVol,
      noVol,
      yesPct,
      noPct: 100 - yesPct,
    };
  }, [allItems]);

  return (
    <div className="surface p-6 space-y-5 rounded-[8px] border-2 border-ink shadow-panel">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider font-display text-ink flex items-center gap-2">
            <Activity className="w-4 h-4 text-magenta" />
            <span>Market Order Flow &amp; Trade Tape</span>
          </h3>
          <p className="text-[11px] text-ash mt-0.5">
            Dedicated execution stream &amp; order analysis for this market only
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator
            isLive={allItems.length > 0}
            label={allItems.length > 0 ? "Live Flow" : "Idle"}
          />
          <span className="text-[11px] font-mono text-ash bg-sheet px-2 py-0.5 rounded border border-hairline">
            {stats.totalCount} {stats.totalCount === 1 ? "trade" : "trades"}
          </span>
        </div>
      </div>

      {/* Market analysis overview bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-cream/60 p-3 rounded-[6px] border border-hairline text-xs font-mono">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-ash block">Analyzed Vol</span>
          <span className="font-bold text-ink text-[13px]">{stats.totalVol.toFixed(2)} SOL</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-ash block">{yesLabel} Vol</span>
          <span className="font-bold text-grass text-[13px]">{stats.yesVol.toFixed(2)} SOL ({stats.yesPct}%)</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-ash block">{noLabel} Vol</span>
          <span className="font-bold text-magenta text-[13px]">{stats.noVol.toFixed(2)} SOL ({stats.noPct}%)</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-ash block">Bias</span>
          <span className={`font-bold flex items-center gap-1 text-[13px] ${stats.yesPct >= 50 ? "text-grass" : "text-magenta"}`}>
            {stats.yesPct >= 50 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {stats.yesPct >= 50 ? `${yesLabel} Heavy` : `${noLabel} Heavy`}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5" role="tablist">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-[4px] border transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-ink text-white border-ink"
                : "bg-sheet text-ink border-hairline hover:bg-cream"
            }`}
          >
            All Flow ({allItems.length})
          </button>
          <button
            onClick={() => setFilter("yes")}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-[4px] border transition-colors cursor-pointer ${
              filter === "yes"
                ? "bg-grass text-ink border-grass font-extrabold"
                : "bg-grass/10 text-grass border-grass/30 hover:bg-grass/20"
            }`}
          >
            {yesLabel} Only
          </button>
          <button
            onClick={() => setFilter("no")}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-[4px] border transition-colors cursor-pointer ${
              filter === "no"
                ? "bg-magenta text-white border-magenta font-extrabold"
                : "bg-magenta/10 text-magenta border-magenta/30 hover:bg-magenta/20"
            }`}
          >
            {noLabel} Only
          </button>
          <button
            onClick={() => setFilter("whale")}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-[4px] border transition-colors cursor-pointer ${
              filter === "whale"
                ? "bg-yellow text-ink border-yellow font-extrabold"
                : "bg-yellow/10 text-ink border-yellow/40 hover:bg-yellow/20"
            }`}
          >
            Whales (≥ 1 SOL)
          </button>
        </div>

        {loading && (
          <span className="text-[10px] font-mono text-ash flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-magenta animate-ping" />
            syncing…
          </span>
        )}
      </div>

      {/* Trade Tape Stream */}
      <div className="space-y-2 font-mono text-xs max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
        {filteredItems.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={filter === "all" ? "No Market Trades Yet" : `No Matching ${filter.toUpperCase()} Trades`}
            description="Trades executed on this market will appear here in real-time with on-chain verification."
          />
        ) : (
          filteredItems.map((item, index) => {
            const sideUpper = String(item.side).toUpperCase();
            const isSettle = sideUpper === "SETTLE";
            const isClaim = sideUpper === "CLAIM";
            const isYes = sideUpper === "YES";
            const isNo = sideUpper === "NO";
            const isNew = index < 2;
            const isWhale = item.cost >= 1.0;

            let badgeCls = "bg-sheet text-ink border-hairline";
            let displaySide = sideUpper;
            if (isYes) {
              badgeCls = "bg-grass text-ink font-extrabold border-grass";
              displaySide = yesLabel;
            } else if (isNo) {
              badgeCls = "bg-magenta text-white font-extrabold border-magenta";
              displaySide = noLabel;
            } else if (isSettle) {
              badgeCls = "bg-cyan text-ink border-cyan font-bold";
            } else if (isClaim) {
              badgeCls = "bg-yellow text-ink border-yellow font-bold";
            }

            return (
              <div
                key={item.signature + "-" + index}
                className={`flex flex-col sm:flex-row sm:items-center justify-between py-2.5 px-3 rounded-[6px] border transition-all duration-150 gap-2 sm:gap-0 ${
                  isNew
                    ? "bg-grass/10 border-grass/40"
                    : isWhale
                    ? "bg-yellow/10 border-yellow/40"
                    : "bg-cream/40 border-hairline/60 hover:bg-sheet"
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider shrink-0 border ${badgeCls}`}
                  >
                    {displaySide}
                  </span>
                  <div className="text-ink text-[12px] truncate">
                    {isSettle ? (
                      <span className="font-bold">
                        SETTLED OUTCOME: {item.quantity === 1 ? yesLabel : noLabel}
                      </span>
                    ) : isClaim ? (
                      <span>REWARD CLAIM: <span className="font-bold text-grass">{item.cost.toFixed(3)} SOL</span></span>
                    ) : (
                      <span>
                        <span className="font-bold text-ink">{item.quantity.toLocaleString()}</span> shares at{" "}
                        <span className="font-bold text-grass">{item.cost.toFixed(3)} SOL</span>
                      </span>
                    )}
                  </div>
                  {isWhale && (
                    <span className="text-[9px] font-mono font-bold text-ink bg-yellow px-1.5 py-0.5 rounded-[3px] border border-ink shrink-0">
                      WHALE
                    </span>
                  )}
                  {isNew && (
                    <span className="text-[8px] font-mono font-bold text-grass bg-grass/20 px-1 py-0.5 rounded-[3px] border border-grass shrink-0 animate-pulse">
                      LIVE
                    </span>
                  )}
                </div>

                <div className="text-ash text-[11px] flex items-center justify-between sm:justify-end space-x-3 shrink-0">
                  <span
                    className="font-mono bg-sheet px-2 py-0.5 rounded border border-hairline/70 text-ink hover:text-magenta transition-colors"
                    title={item.buyer}
                  >
                    @{shortAddr(item.buyer)}
                  </span>
                  <span className="text-ash-dim">{item.time}</span>
                  {item.signature && !item.signature.includes("...") && (
                    <a
                      href={`https://solscan.io/tx/${item.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ash hover:text-ink transition-colors p-1"
                      title="View transaction on Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
