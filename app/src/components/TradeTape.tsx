"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtime } from "@/hooks/useRealtime";

interface TapeItem {
  signature: string;
  trader: string;
  side: "YES" | "NO";
  lamportsIn: number;
  tokensOut: number;
  blockTime: string;
  question?: string;
}

function short(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

/**
 * The tape — live exchange trade feed scrolling across the terminal.
 */
export function TradeTape({ initial }: { initial: TapeItem[] }) {
  const [trades, setTrades] = useState<TapeItem[]>(initial);
  const seen = useRef<Set<string>>(new Set(initial.map((t) => t.signature)));

  const rt = useRealtime("global");
  useEffect(() => {
    const unsub = rt.on("activity", (payload) => {
      const incoming = Array.isArray(payload) ? (payload as TapeItem[]) : [];
      setTrades((prev) => {
        const fresh = incoming.filter((t) => !seen.current.has(t.signature));
        for (const t of fresh) seen.current.add(t.signature);
        return fresh.length > 0 ? [...fresh, ...prev].slice(0, 24) : prev;
      });
    });
    return () => unsub?.();
  }, [rt]);

  if (trades.length === 0) return null;

  return (
    <div
      className="w-full overflow-hidden py-2 bg-[#0D0F1C] border-b border-[#1E2240]"
      aria-label="Recent trades"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 flex items-center gap-0 overflow-x-auto no-scrollbar">
        <span className="font-sans text-[10px] font-medium text-[#2E3255] shrink-0 mr-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-pulse" />
          Tape
        </span>
        <span className="w-px h-3 bg-[#1E2240] shrink-0 mr-3" aria-hidden />
        {trades.map((t, i) => (
          <span
            key={t.signature}
            className="shrink-0 inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums whitespace-nowrap pr-4"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                t.side === "YES" ? "bg-[#00E5CC]" : "bg-[#E040FB]"
              }`}
              aria-hidden
            />
            <span className="text-[#4D5180]">{short(t.trader)}</span>
            <span className="text-[#E8EAF6] font-semibold">
              {(Math.abs(t.tokensOut || 0) / 1e6).toFixed(0)}x
            </span>
            <span
              className={`font-bold ${
                t.side === "YES" ? "text-[#33F0D8]" : "text-[#EA6EFF]"
              }`}
            >
              {t.side}
            </span>
            <span className="text-[#8B90B8]">
              @{" "}
              {(
                Math.abs(t.lamportsIn || 0) /
                1e9 /
                Math.max(1e-9, Math.abs(t.tokensOut || 1) / 1e6)
              ).toFixed(3)}{" "}
              SOL
            </span>
            {i < trades.length - 1 && (
              <span className="text-[#1E2240] ml-2">·</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
