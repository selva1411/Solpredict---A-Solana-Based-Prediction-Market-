"use client";

import { useSolPrice } from "@/hooks/useSolPrice";

export function GlobalPriceTicker() {
  const { solPrice, loading } = useSolPrice();

  return (
    <div className="px-3 sm:px-4 pt-3 hidden sm:block">
      <div className="mx-auto w-full max-w-[1240px] flex items-center justify-between gap-3 px-4 py-2 rounded-[4px] bg-ink-fill text-white">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-grass opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-grass" />
          </span>
          LIVE SETTLEMENT
        </span>
        <span className="inline-flex items-center gap-3">
          <span className="num font-mono text-[13px] font-bold">
            SOL{" "}
            <span className="text-grass">
              {loading
                ? "—"
                : `$${solPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </span>
          </span>
          <span className="hidden md:inline font-mono text-[10px] uppercase tracking-widest text-white/60">
            Solana Prediction Markets · Pyth oracle
          </span>
        </span>
      </div>
    </div>
  );
}
