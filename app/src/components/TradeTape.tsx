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
      className="w-full overflow-hidden py-1.5 bg-[#F8F7F4]/90 dark:bg-[#101216]/90 backdrop-blur-md border-b border-[#E2DFD7] dark:border-[#22272E] transition-colors"
      aria-label="Recent trades"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 flex items-center gap-0 overflow-x-auto no-scrollbar">
        <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#1F3A52] dark:text-[#7A9BB5] shrink-0 mr-3 flex items-center gap-1.5 bg-[#F1EFEA] dark:bg-[#1B1F24] px-2 py-0.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1D7C59] dark:bg-[#00E5CC] animate-pulse" />
          Live Tape
        </span>
        <span className="w-px h-3 bg-[#E2DFD7] dark:border-[#2A2F36] shrink-0 mr-3" aria-hidden />
        {trades.map((t, i) => (
          <span
            key={t.signature}
            className="shrink-0 inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums whitespace-nowrap pr-4 py-0.5"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                t.side === "YES" ? "bg-[#1D7C59] dark:bg-[#00E5CC]" : "bg-[#B43C34] dark:bg-[#FF5370]"
              }`}
              aria-hidden
            />
            <span className="text-[#555D65] dark:text-[#8B949E] font-medium">{short(t.trader)}</span>
            <span className="text-[#0A0B0D] dark:text-[#EAE8E3] font-semibold">
              {(Math.abs(t.tokensOut || 0) / 1e6).toFixed(0)}x
            </span>
            <span
              className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                t.side === "YES"
                  ? "bg-[#EDF6F1] text-[#0F5A3E] dark:bg-[#1D7C59]/20 dark:text-[#52B788]"
                  : "bg-[#FBF1F0] text-[#8E261F] dark:bg-[#B43C34]/20 dark:text-[#FF7B72]"
              }`}
            >
              {t.side}
            </span>
            <span className="text-[#3A414A] dark:text-[#9AA1AA]">
              @{" "}
              {(
                Math.abs(t.lamportsIn || 0) /
                1e9 /
                Math.max(1e-9, Math.abs(t.tokensOut || 1) / 1e6)
              ).toFixed(3)}{" "}
              SOL
            </span>
            {i < trades.length - 1 && (
              <span className="text-[#D0CCC2] dark:text-[#2A2F36] ml-2">·</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
