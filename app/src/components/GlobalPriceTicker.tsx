"use client";

import { useSolPrice } from "@/hooks/useSolPrice";
import { ShieldCheck, Zap } from "lucide-react";

export function GlobalPriceTicker() {
  const { solPrice, loading } = useSolPrice();

  return (
    <div className="px-4 sm:px-6 pt-2 hidden sm:block">
      <div className="mx-auto w-full max-w-[1440px] flex items-center justify-between gap-4 px-3.5 py-1.5 rounded-[3px] bg-[#F1EFEA] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36]">
        {/* Left: Live Oracles Status */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-medium uppercase tracking-wider text-[#181B1F] dark:text-[#9AA1AA]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1D7C59]" />
            <span className="text-[#1D7C59] dark:text-[#52B788] font-bold">Pyth Oracle Live</span>
          </span>
          <span className="h-3 w-px bg-[#E2DFD7] dark:bg-[#2A2F36]" />
          <span className="hidden lg:inline-flex items-center gap-1.5 font-mono text-[10px] text-[#2C3138] dark:text-[#68707B] font-medium">
            <Zap className="w-3 h-3 text-[#1F3A52] dark:text-[#7A9BB5]" />
            <span>Sub-Second Latency</span>
          </span>
        </div>

        {/* Center: Live Reference Tickers */}
        <div className="flex items-center gap-4 sm:gap-6 font-mono text-[11px]">
          {/* SOL/USD */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#2C3138] dark:text-[#68707B] font-bold">SOL</span>
            <span className="text-[#0A0B0D] dark:text-[#EAE8E3] font-bold tabular-nums">
              {loading
                ? "—"
                : `$${solPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </span>
            <span className="text-[10px] text-[#1D7C59] dark:text-[#52B788] font-semibold">
              +3.4%
            </span>
          </div>

          <span className="h-3 w-px bg-[#E2DFD7] dark:bg-[#2A2F36]" />

          {/* BTC/USD Reference */}
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-[#2C3138] dark:text-[#68707B] font-bold">BTC</span>
            <span className="text-[#0A0B0D] dark:text-[#EAE8E3] font-bold tabular-nums">$67,820</span>
            <span className="text-[10px] text-[#1D7C59] dark:text-[#52B788] font-semibold">
              +1.8%
            </span>
          </div>

          <span className="hidden md:inline h-3 w-px bg-[#E2DFD7] dark:bg-[#2A2F36]" />

          {/* ETH/USD Reference */}
          <div className="hidden xl:flex items-center gap-1.5">
            <span className="text-[#2C3138] dark:text-[#68707B] font-bold">ETH</span>
            <span className="text-[#0A0B0D] dark:text-[#EAE8E3] font-bold tabular-nums">$2,545</span>
            <span className="text-[10px] text-[#1D7C59] dark:text-[#52B788] font-semibold">
              +2.1%
            </span>
          </div>
        </div>

        {/* Right: AMM & Settlement Status */}
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#2C3138] dark:text-[#68707B]">
          <span className="hidden lg:inline-flex items-center gap-1 text-[#181B1F] dark:text-[#9AA1AA] font-semibold">
            <ShieldCheck className="w-3 h-3 text-[#1F3A52] dark:text-[#7A9BB5]" />
            CPMM AMM v1
          </span>
          <span className="hidden lg:inline h-3 w-px bg-[#E2DFD7] dark:bg-[#2A2F36]" />
          <span className="text-[#1F3A52] dark:text-[#7A9BB5] font-bold">Solana Devnet</span>
        </div>
      </div>
    </div>
  );
}

