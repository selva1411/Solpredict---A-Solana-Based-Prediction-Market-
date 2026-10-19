"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useSolPrice } from "@/hooks/useSolPrice";
import { RotateCw, AlertTriangle, Droplets } from "lucide-react";
import { triggerWalletBalanceRefresh, forceWalletBalanceRefresh } from "@/hooks/useWalletBalance";

export function WalletBalanceBadge() {
  const { publicKey } = useWallet();
  const { balanceSol, formattedSol, loading, refetch } = useWalletBalance();
  const { solPrice } = useSolPrice();
  const [refreshing, setRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  if (!publicKey) return null;

  const handleManualRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshing) return;
    setRefreshing(true);
    try {
      forceWalletBalanceRefresh();
      await refetch();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const usdValue =
    balanceSol !== null && solPrice > 0
      ? (balanceSol * solPrice).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;

  const isLow = balanceSol !== null && balanceSol < 0.05;

  return (
    <div
      className="relative hidden sm:flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`flex items-center gap-1.5 px-2.5 h-[30px] rounded-[3px] border shadow-xs transition-all duration-150 cursor-pointer select-none hover:-translate-y-0.5 hover:shadow-sm ${
          isLow
            ? "border-[#E59866] dark:border-[#C47D3B] bg-[#FDF6E2] dark:bg-[#2A2016]"
            : "border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] hover:border-[#1F3A52] dark:hover:border-[#7A9BB5]"
        }`}
        onClick={() => setShowTooltip((prev) => !prev)}
        title="Connected Wallet SOL Balance"
        data-testid="wallet-sol-balance"
      >
        {isLow ? (
          <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
        ) : (
          <span className="font-mono text-[12px] font-bold text-[#1F3A52] dark:text-[#7A9BB5] leading-none shrink-0">
            ◎
          </span>
        )}

        <div className="flex items-baseline gap-1">
          <span className="font-mono text-[11px] font-semibold text-[#0A0B0D] dark:text-[#EAE8E3] tabular-nums">
            {loading && balanceSol === null ? "..." : formattedSol}
          </span>
          <span className="text-[10px] text-[#3A414A] dark:text-[#9AA1AA] font-mono font-medium">
            SOL
          </span>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          className={`p-0.5 ml-0.5 text-[#7F8892] dark:text-[#68707B] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors rounded-[2px] cursor-pointer ${
            refreshing || loading ? "animate-spin text-[#1F3A52] dark:text-[#7A9BB5]" : ""
          }`}
          title="Refresh balance"
          aria-label="Refresh wallet balance"
        >
          <RotateCw className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Popover / Tooltip */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1.5 w-56 p-2.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21] shadow-lg z-50 text-[11px] font-mono animate-in fade-in zoom-in-95 duration-100">
          <div className="text-[10px] uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-bold mb-1">
            Wallet Balance
          </div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[#555D65] dark:text-[#9AA1AA]">Remaining:</span>
            <span className="font-bold text-[#0A0B0D] dark:text-[#EAE8E3] tabular-nums">
              {balanceSol !== null ? `${balanceSol.toFixed(4)} SOL` : "—"}
            </span>
          </div>
          {usdValue && (
            <div className="flex justify-between items-baseline mb-2 text-[#7F8892] dark:text-[#68707B] text-[10px]">
              <span>Est. USD:</span>
              <span className="tabular-nums">≈ ${usdValue}</span>
            </div>
          )}

          {isLow && (
            <div className="mt-2 pt-2 border-t border-[#E2DFD7] dark:border-[#2A2F36] text-[10px] text-[#B45309] dark:text-[#FBBF24] leading-tight">
              Low SOL balance! You may not have enough gas for trades. Use the Faucet button to request test SOL.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
