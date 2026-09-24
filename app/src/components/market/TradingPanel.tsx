import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { ENV } from "@/lib/env";

/**
 * TradingPanel — the buy / sell / liquidity panel extracted from MarketDetailClient.
 *
 * Rendered in both the desktop sidebar and the mobile drawer. All state and
 * handlers remain in the parent; this component is a thin presentational layer
 * that calls back via props.
 */

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

interface UserOrder {
  account: {
    side: { yes?: Record<string, never>; no?: Record<string, never> };
    isBuy: boolean;
    priceBps: { toNumber(): number };
    quantity: { toNumber(): number };
    filledQuantity: { toNumber(): number };
  };
}

export interface TradingPanelProps {
  /* Market state */
  status: string;
  marketPdaB58: string;

  /* Custom Outcome Labels */
  yesLabel?: string;
  noLabel?: string;

  /* Computed prices */
  yesProb: number;
  noProb: number;
  yesPool: number;
  noPool: number;
  sharePriceSol: number;
  activeSharePriceSol: number;
  yesSharePriceSol: number;
  noSharePriceSol: number;
  tradeCost: number;
  potentialPayout: number;
  priceImpactPct: number;
  slippageWarning: boolean;
  sellRefundSol: number;
  sellUnavailable: boolean;

  /* LP preview */
  lp: {
    yesAddSol: number;
    noAddSol: number;
    lpTokensMinted: number;
    newYesPoolSol: number;
    newNoPoolSol: number;
  };
  lpTokensMinted: number;
  lpNewYesPoolSol: number;
  lpNewNoPoolSol: number;

  /* User state */
  userYesBalance: number;
  userNoBalance: number;
  userOrders: UserOrder[];
  userLp: {
    lpShares: number;
    deposited: string | number;
    feesEarned: string | number;
  } | null;
  marketLpStats: {
    totalLiquiditySol: string | number | null;
    totalLpTokens: number | null;
    feeEarnedSol: string | number | null;
  } | null;

  /* Trade tab state */
  tradeTab: "buy" | "sell" | "liquidity";
  tradeSide: "YES" | "NO";
  quantity: number;
  sellSide: "YES" | "NO";
  sellQuantity: number;
  isLimitOrder: boolean;
  limitPriceSol: number;
  showAdvanced: boolean;
  lpOption: "balanced" | "yes" | "no";
  lpDepositAmount: number;

  /* Tx state */
  submitting: boolean;
  txState: "idle" | "signing" | "confirming" | "success" | "error";
  txSig: string | null;

  /* Setters */
  setTradeTab: (tab: "buy" | "sell" | "liquidity") => void;
  setTradeSide: (side: "YES" | "NO") => void;
  setQuantity: (q: number) => void;
  setSellSide: (side: "YES" | "NO") => void;
  setSellQuantity: (q: number) => void;
  setIsLimitOrder: (v: boolean) => void;
  setLimitPriceSol: (v: number) => void;
  setShowAdvanced: (v: boolean) => void;
  setLpOption: (opt: "balanced" | "yes" | "no") => void;
  setLpDepositAmount: (v: number) => void;

  /* Callbacks */
  handleBuy: () => void;
  handleSell: () => void;
  handleProvideLiquidity: () => void;
  handlePlaceLimitOrder: (isBuy: boolean) => void;
  handleCancelOrder: (order: UserOrder) => void;
}

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */

export function TradingPanel(p: TradingPanelProps) {
  const {
    status,
    marketPdaB58,
    yesLabel = "YES",
    noLabel = "NO",
    yesProb,
    noProb,
    yesPool,
    noPool,
    sharePriceSol,
    activeSharePriceSol,
    yesSharePriceSol,
    noSharePriceSol,
    tradeCost,
    potentialPayout,
    priceImpactPct,
    slippageWarning,
    sellRefundSol,
    sellUnavailable,
    lp,
    lpTokensMinted,
    lpNewYesPoolSol,
    lpNewNoPoolSol,
    userYesBalance,
    userNoBalance,
    userOrders,
    userLp,
    marketLpStats,
    tradeTab,
    tradeSide,
    quantity,
    sellSide,
    sellQuantity,
    isLimitOrder,
    limitPriceSol,
    showAdvanced,
    lpOption,
    lpDepositAmount,
    submitting,
    txState,
    txSig,
    setTradeTab,
    setTradeSide,
    setQuantity,
    setSellSide,
    setSellQuantity,
    setIsLimitOrder,
    setLimitPriceSol,
    setShowAdvanced,
    setLpOption,
    setLpDepositAmount,
    handleBuy,
    handleSell,
    handleProvideLiquidity,
    handlePlaceLimitOrder,
    handleCancelOrder,
  } = p;

  /* ------- closed-market banner ------- */
  if (status !== "Open") {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#1A1D21] rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36]">
        <div className="w-12 h-12 rounded-[3px] flex items-center justify-center mx-auto mb-4 bg-[#FBF1F0] dark:bg-[rgba(180,60,52,0.15)] border border-[#ECCDC9] dark:border-[#B43C34]/30">
          <AlertCircle className="w-5 h-5 text-[#B43C34]" />
        </div>
        <h4 className="font-sans font-bold text-[17px] text-[#181A1C] dark:text-[#EAE8E3] mb-1.5">
          {status === "Cancelled"
            ? "Market Cancelled"
            : status === "Ended"
            ? "Trading Ended"
            : "Market Settled"}
        </h4>
        <p className="text-[12px] text-[#555D65] dark:text-[#9AA1AA] leading-relaxed max-w-[34ch] mx-auto">
          {status === "Cancelled" ? (
            "This market was cancelled. Deposited funds are being returned to traders — no action needed."
          ) : status === "Ended" ? (
            "Trading for this market has ended. Oracle resolution is pending."
          ) : (
            <>
              This market has settled. Go to your{" "}
              <Link
                href="/dashboard"
                className="text-[#1F3A52] dark:text-[#7A9BB5] hover:underline font-semibold"
              >
                Dashboard
              </Link>{" "}
              to withdraw payout.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* ── Buy / Sell / Liquidity Tabs ── */}
      <div className="grid grid-cols-3 rounded-[3px] p-1 gap-1 bg-[#F1EFEA] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36]">
        {(["buy", "sell", "liquidity"] as const).map((tab) => (
          <button
            key={tab}
            data-testid={`tab-${tab}`}
            onClick={() => setTradeTab(tab)}
            className={`rounded-[2px] py-1.5 text-[11px] font-sans font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              tradeTab === tab
                ? "bg-white dark:bg-[#21252A] text-[#181A1C] dark:text-[#EAE8E3] shadow-xs"
                : "text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
            }`}
          >
            {tab === "liquidity" ? "LP Pool" : tab}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          BUY TAB
         ════════════════════════════════════════════════════════════════ */}
      {tradeTab === "buy" ? (
        <div className="space-y-3.5">
          {/* Position selector — dominant YES/NO cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setTradeSide("YES")}
              className={`flex flex-col items-start justify-between p-3.5 transition-colors cursor-pointer rounded-[3px] border text-left ${
                tradeSide === "YES"
                  ? "border-[#1D7C59] bg-[#EDF6F1] dark:bg-[rgba(29,124,89,0.15)] ring-1 ring-[#1D7C59]"
                  : "border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21] hover:border-[#BCDDCF] dark:hover:border-[#1D7C59]/40"
              }`}
              style={{ minHeight: "116px" }}
            >
              <div className="w-full flex items-center justify-between">
                <span
                  className={`font-sans text-[11px] uppercase tracking-wider font-semibold line-clamp-1 ${
                    tradeSide === "YES" ? "text-[#1D7C59] dark:text-[#52B788]" : "text-[#555D65] dark:text-[#9AA1AA]"
                  }`}
                >
                  {yesLabel}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded-[2px] font-bold ${
                    tradeSide === "YES"
                      ? "bg-[#1D7C59] text-white"
                      : "bg-[#F1EFEA] dark:bg-[#21252A] text-[#7F8892] dark:text-[#9AA1AA]"
                  }`}
                >
                  BUY
                </span>
              </div>
              <span
                className={`font-mono font-bold text-[34px] leading-none tabular-nums my-1 ${
                  tradeSide === "YES" ? "text-[#1D7C59] dark:text-[#52B788]" : "text-[#181A1C] dark:text-[#EAE8E3]"
                }`}
              >
                {yesProb}¢
              </span>
              <span className="font-mono text-[10px] text-[#7F8892] dark:text-[#68707B]">
                {yesSharePriceSol.toFixed(4)} SOL · {yesPool.toFixed(1)} pool
              </span>
            </button>

            <button
              onClick={() => setTradeSide("NO")}
              className={`flex flex-col items-start justify-between p-3.5 transition-colors cursor-pointer rounded-[3px] border text-left ${
                tradeSide === "NO"
                  ? "border-[#B43C34] bg-[#FBF1F0] dark:bg-[rgba(180,60,52,0.15)] ring-1 ring-[#B43C34]"
                  : "border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21] hover:border-[#ECCDC9] dark:hover:border-[#B43C34]/40"
              }`}
              style={{ minHeight: "116px" }}
            >
              <div className="w-full flex items-center justify-between">
                <span
                  className={`font-sans text-[11px] uppercase tracking-wider font-semibold line-clamp-1 ${
                    tradeSide === "NO" ? "text-[#B43C34] dark:text-[#E57373]" : "text-[#555D65] dark:text-[#9AA1AA]"
                  }`}
                >
                  {noLabel}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded-[2px] font-bold ${
                    tradeSide === "NO"
                      ? "bg-[#B43C34] text-white"
                      : "bg-[#F1EFEA] dark:bg-[#21252A] text-[#7F8892] dark:text-[#9AA1AA]"
                  }`}
                >
                  BUY
                </span>
              </div>
              <span
                className={`font-mono font-bold text-[34px] leading-none tabular-nums my-1 ${
                  tradeSide === "NO" ? "text-[#B43C34] dark:text-[#E57373]" : "text-[#181A1C] dark:text-[#EAE8E3]"
                }`}
              >
                {noProb}¢
              </span>
              <span className="font-mono text-[10px] text-[#7F8892] dark:text-[#68707B]">
                {noSharePriceSol.toFixed(4)} SOL · {noPool.toFixed(1)} pool
              </span>
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#555D65] dark:text-[#9AA1AA] font-semibold">
                Shares to buy
              </label>
              <span className="font-mono text-[10px] text-[#7F8892] dark:text-[#68707B] tabular-nums">
                {tradeSide === "YES"
                  ? `${userYesBalance.toFixed(1)} ${yesLabel} held`
                  : `${userNoBalance.toFixed(1)} ${noLabel} held`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 rounded-[3px] font-mono font-bold text-[15px] text-[#181A1C] dark:text-[#EAE8E3] cursor-pointer transition-colors bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2A2F36] hover:bg-[#EAE8E3] dark:hover:bg-[#2E353F]"
              >
                −
              </button>
              <input
                type="number"
                data-testid="buy-quantity"
                step={1}
                value={quantity}
                min={1}
                onChange={(e) =>
                  setQuantity(
                    Math.max(1, Math.floor(Number(e.target.value)) || 0)
                  )
                }
                className="flex-1 rounded-[3px] px-3 py-1.5 font-mono text-[15px] font-bold text-[#181A1C] dark:text-[#EAE8E3] text-center focus:outline-none focus:border-[#1F3A52] dark:focus:border-[#7A9BB5] transition-colors bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36]"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-9 h-9 rounded-[3px] font-mono font-bold text-[15px] text-[#181A1C] dark:text-[#EAE8E3] cursor-pointer transition-colors bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2A2F36] hover:bg-[#EAE8E3] dark:hover:bg-[#2E353F]"
              >
                +
              </button>
            </div>

            {/* Quick-pick buttons */}
            <div className="flex gap-1.5 flex-wrap">
              {[10, 25, 50, 100, 250].map((n) => (
                <button
                  key={n}
                  onClick={() => setQuantity(n)}
                  className="flex-1 min-w-[40px] py-1 font-mono text-[10px] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] cursor-pointer transition-colors rounded-[3px] bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] hover:border-[#B8B4A8] text-center font-medium"
                >
                  +{n}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced: Limit Order toggle */}
          <div className="border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] overflow-hidden bg-white dark:bg-[#1A1D21]">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] cursor-pointer transition-colors bg-[#F8F7F4] dark:bg-[#21252A]"
            >
              <span>Advanced: Limit Order</span>
              <span
                className={`transition-transform ${
                  showAdvanced ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>
            {showAdvanced && (
              <div className="px-3 pb-3 pt-2 bg-white dark:bg-[#1A1D21] space-y-3 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="buy-limit-toggle"
                    onClick={() => setIsLimitOrder(!isLimitOrder)}
                    className={`relative w-8 h-4 rounded-[2px] transition-colors cursor-pointer ${
                      isLimitOrder ? "bg-[#1F3A52] dark:bg-[#7A9BB5]" : "bg-[#E2DFD7] dark:bg-[#2A2F36]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 bg-white rounded-[1px] transition-all ${
                        isLimitOrder ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <span className="text-[11px] text-[#555D65] dark:text-[#9AA1AA]">
                    Place as limit order
                  </span>
                </div>
                {isLimitOrder && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-[#7F8892] dark:text-[#68707B] uppercase tracking-wider">
                      <span>Limit Price (SOL/share)</span>
                      <button
                        type="button"
                        onClick={() =>
                          setLimitPriceSol(
                            Number(activeSharePriceSol.toFixed(4))
                          )
                        }
                        className="text-[#1F3A52] dark:text-[#7A9BB5] hover:underline font-mono"
                      >
                        Use Current ({activeSharePriceSol.toFixed(4)})
                      </button>
                    </div>
                    <input
                      data-testid="limit-price"
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      max="10"
                      value={limitPriceSol}
                      onChange={(e) =>
                        setLimitPriceSol(
                          Math.max(0.0001, Math.min(10, Number(e.target.value)))
                        )
                      }
                      className="w-full bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] px-3 py-1.5 text-[12px] font-mono text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trade summary card */}
          <div className="bg-[#F8F7F4] dark:bg-[#1A1D21] rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#555D65] dark:text-[#9AA1AA]">Cost</span>
              <span className="font-mono font-semibold text-[#181A1C] dark:text-[#EAE8E3] tabular-nums">
                {tradeCost.toFixed(4)} SOL
              </span>
            </div>
            <div className="h-px bg-[#E2DFD7] dark:bg-[#2A2F36]" />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#555D65] dark:text-[#9AA1AA]">Potential Payout (100¢)</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  tradeSide === "YES" ? "text-[#1D7C59] dark:text-[#52B788]" : "text-[#B43C34] dark:text-[#E57373]"
                }`}
              >
                {potentialPayout.toFixed(4)} SOL
              </span>
            </div>
            {priceImpactPct > 0 && (
              <div className="flex items-center justify-between text-[10px] pt-0.5">
                <span className="text-[#7F8892] dark:text-[#68707B]">Price impact</span>
                <span
                  className={`font-mono tabular-nums ${
                    priceImpactPct > 5 ? "text-[#B43C34]" : "text-[#7F8892] dark:text-[#68707B]"
                  }`}
                >
                  {priceImpactPct.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {slippageWarning && (
            <div className="px-3 py-2 rounded-[3px] font-mono text-[10px] leading-snug bg-[#FBF1F0] dark:bg-[rgba(180,60,52,0.15)] border border-[#ECCDC9] dark:border-[#B43C34]/30 text-[#B43C34] dark:text-[#E57373]">
              ⚠ High price impact — consider a smaller position.
            </div>
          )}

          {/* CTA Button — colored by selected side */}
          <motion.button
            data-testid="buy-submit"
            disabled={submitting || quantity < 1}
            onClick={
              isLimitOrder ? () => handlePlaceLimitOrder(true) : handleBuy
            }
            whileTap={{ scale: 0.98 }}
            className={`w-full h-11 font-sans font-semibold text-[13px] tracking-wide cursor-pointer transition-colors rounded-[3px] disabled:opacity-40 disabled:cursor-not-allowed ${
              tradeSide === "YES"
                ? "bg-[#1D7C59] hover:bg-[#166347] text-white"
                : "bg-[#B43C34] hover:bg-[#962F28] text-white"
            }`}
          >
            {submitting
              ? "Submitting to Solana..."
              : isLimitOrder
              ? `Place Limit ${tradeSide === "YES" ? yesLabel : noLabel} Order`
              : `Buy ${quantity} ${tradeSide === "YES" ? yesLabel : noLabel}`}
          </motion.button>

          {/* Tx status */}
          {txState === "signing" && (
            <p className="text-center text-xs font-mono text-[#1F3A52] dark:text-[#7A9BB5]">
              Approve in wallet...
            </p>
          )}
          {txState === "confirming" && (
            <p className="text-center text-xs font-mono text-[#555D65] dark:text-[#9AA1AA]">
              Confirming on-chain...
            </p>
          )}
          {txState === "success" && txSig && (
            <p className="text-center text-xs font-mono text-[#1D7C59] dark:text-[#52B788]">
              ✓ Done —{" "}
              <a
                href={`https://solscan.io/tx/${txSig}${
                  ENV.cluster === "mainnet-beta"
                    ? ""
                    : `?cluster=${ENV.cluster}`
                }`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#181A1C] dark:hover:text-white"
              >
                View tx
              </a>
            </p>
          )}

          {/* User's open limit orders on this market */}
          {userOrders.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
              <span className="text-[10px] font-mono text-[#7F8892] dark:text-[#68707B] uppercase tracking-wider font-semibold">
                Your Open Orders ({userOrders.length})
              </span>
              {userOrders.map((ordAcc, i) => {
                const ord = ordAcc.account;
                const sideStr = ord.side.yes !== undefined ? yesLabel : noLabel;
                const priceSol = (ord.priceBps.toNumber() / 10000).toFixed(4);
                const qty2 = ord.quantity.toNumber();
                const filled = ord.filledQuantity.toNumber();
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-[3px] bg-[#F8F7F4] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] text-[10px] font-mono"
                  >
                    <div>
                      <span
                        className={
                          ord.side.yes !== undefined
                            ? "text-[#1D7C59] dark:text-[#52B788] font-bold"
                            : "text-[#B43C34] dark:text-[#E57373] font-bold"
                        }
                      >
                        {ord.isBuy ? "BUY" : "SELL"} {sideStr}
                      </span>
                      <span className="text-[#7F8892] dark:text-[#68707B] ml-2">@ {priceSol} SOL</span>
                      <span className="text-[#7F8892] dark:text-[#68707B] ml-2">
                        {filled}/{qty2} filled
                      </span>
                    </div>
                    <button
                      onClick={() => handleCancelOrder(ordAcc)}
                      className="text-[#B43C34] dark:text-[#E57373] hover:underline cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : /* ════════════════════════════════════════════════════════════════
          SELL TAB
         ════════════════════════════════════════════════════════════════ */
      tradeTab === "sell" ? (
        <div className="space-y-3.5">
          {/* User balances */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-[3px] text-center bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] border-t-2 border-t-[#1D7C59]">
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#1D7C59] dark:text-[#52B788] font-bold mb-1">
                {yesLabel} Balance
              </div>
              <div className="font-mono font-bold text-[22px] text-[#181A1C] dark:text-[#EAE8E3] leading-none tabular-nums">
                {userYesBalance.toFixed(1)}
              </div>
            </div>
            <div className="p-3 rounded-[3px] text-center bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] border-t-2 border-t-[#B43C34]">
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#B43C34] dark:text-[#E57373] font-bold mb-1">
                {noLabel} Balance
              </div>
              <div className="font-mono font-bold text-[22px] text-[#181A1C] dark:text-[#EAE8E3] leading-none tabular-nums">
                {userNoBalance.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Which side to sell */}
          <div className="grid grid-cols-2 gap-2">
            {(["YES", "NO"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSellSide(s)}
                className={`py-2 px-3 rounded-[3px] border text-[11px] font-sans font-semibold uppercase tracking-wider cursor-pointer transition-colors truncate ${
                  sellSide === s
                    ? s === "YES"
                      ? "border-[#1D7C59] bg-[#EDF6F1] dark:bg-[rgba(29,124,89,0.15)] text-[#1D7C59] dark:text-[#52B788]"
                      : "border-[#B43C34] bg-[#FBF1F0] dark:bg-[rgba(180,60,52,0.15)] text-[#B43C34] dark:text-[#E57373]"
                    : "border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                }`}
              >
                Sell {s === "YES" ? yesLabel : noLabel}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#555D65] dark:text-[#9AA1AA] font-semibold">
                Sell Quantity
              </label>
              <button
                onClick={() =>
                  setSellQuantity(
                    Math.floor(
                      sellSide === "YES" ? userYesBalance : userNoBalance
                    )
                  )
                }
                className="text-[10px] text-[#1F3A52] dark:text-[#7A9BB5] hover:underline cursor-pointer font-mono font-bold"
              >
                MAX (
                {Math.floor(
                  sellSide === "YES" ? userYesBalance : userNoBalance
                )}
                )
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSellQuantity(Math.max(1, sellQuantity - 5))}
                className="w-9 h-9 rounded-[3px] bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2A2F36] text-[#181A1C] dark:text-[#EAE8E3] font-mono font-bold cursor-pointer hover:bg-[#EAE8E3] dark:hover:bg-[#2E353F] transition-colors"
              >
                −
              </button>
              <input
                type="number"
                data-testid="sell-quantity"
                step={1}
                value={sellQuantity}
                min={1}
                onChange={(e) =>
                  setSellQuantity(
                    Math.max(1, Math.floor(Number(e.target.value)) || 0)
                  )
                }
                className="flex-1 bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] px-3 py-1.5 text-center text-[15px] font-mono font-bold text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52]"
              />
              <button
                onClick={() => setSellQuantity(sellQuantity + 5)}
                className="w-9 h-9 rounded-[3px] bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2A2F36] text-[#181A1C] dark:text-[#EAE8E3] font-mono font-bold cursor-pointer hover:bg-[#EAE8E3] dark:hover:bg-[#2E353F] transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Advanced: Limit Sell Ask toggle */}
          <div className="border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] overflow-hidden bg-white dark:bg-[#1A1D21]">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] cursor-pointer transition-colors bg-[#F8F7F4] dark:bg-[#21252A]"
            >
              <span>Advanced: Limit Sell (Ask)</span>
              <span
                className={`transition-transform ${
                  showAdvanced ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>
            {showAdvanced && (
              <div className="px-3 pb-3 pt-2 bg-white dark:bg-[#1A1D21] space-y-3 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="sell-limit-toggle"
                    onClick={() => setIsLimitOrder(!isLimitOrder)}
                    className={`relative w-8 h-4 rounded-[2px] transition-colors cursor-pointer ${
                      isLimitOrder ? "bg-[#1F3A52] dark:bg-[#7A9BB5]" : "bg-[#E2DFD7] dark:bg-[#2A2F36]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 bg-white rounded-[1px] transition-all ${
                        isLimitOrder ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <span className="text-[11px] text-[#555D65] dark:text-[#9AA1AA]">
                    Place as limit sell ask
                  </span>
                </div>
                {isLimitOrder && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-[#7F8892] dark:text-[#68707B] uppercase tracking-wider">
                      <span>Ask Price (SOL/share)</span>
                      <button
                        type="button"
                        onClick={() =>
                          setLimitPriceSol(
                            Number(activeSharePriceSol.toFixed(4))
                          )
                        }
                        className="text-[#1F3A52] dark:text-[#7A9BB5] hover:underline font-mono"
                      >
                        Use Current ({activeSharePriceSol.toFixed(4)})
                      </button>
                    </div>
                    <input
                      data-testid="limit-price"
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      max="10"
                      value={limitPriceSol}
                      onChange={(e) =>
                        setLimitPriceSol(
                          Math.max(0.0001, Math.min(10, Number(e.target.value)))
                        )
                      }
                      className="w-full bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] px-3 py-1.5 text-[12px] font-mono text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-[#F8F7F4] dark:bg-[#1A1D21] rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] p-3 space-y-2 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-[#555D65] dark:text-[#9AA1AA]">Shares to sell</span>
              <span className="text-[#181A1C] dark:text-[#EAE8E3] font-bold tabular-nums">
                {sellQuantity} {sellSide}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#E2DFD7] dark:border-[#2A2F36] pt-2">
              <span className="text-[#555D65] dark:text-[#9AA1AA]">Est. payout</span>
              <span className="text-[#1D7C59] dark:text-[#52B788] font-bold tabular-nums">
                {isLimitOrder
                  ? (sellQuantity * limitPriceSol).toFixed(4)
                  : sellRefundSol.toFixed(4)}{" "}
                SOL
              </span>
            </div>
          </div>

          {!isLimitOrder && sellQuantity > 0 && sellUnavailable && (
            <div className="bg-[#FBF1F0] dark:bg-[rgba(180,60,52,0.15)] border border-[#ECCDC9] dark:border-[#B43C34]/30 rounded-[3px] p-2.5 text-[10px] font-mono text-[#B43C34] dark:text-[#E57373] leading-snug">
              The treasury cannot cover this payout — the on-chain sell
              would revert. Reduce the quantity or wait for the pool to refill
              before selling.
            </div>
          )}

          <motion.button
            data-testid="sell-submit"
            disabled={
              submitting ||
              (sellSide === "YES"
                ? userYesBalance < sellQuantity
                : userNoBalance < sellQuantity) ||
              (!isLimitOrder && sellUnavailable)
            }
            onClick={
              isLimitOrder ? () => handlePlaceLimitOrder(false) : handleSell
            }
            whileTap={{ scale: 0.98 }}
            className={`w-full h-11 font-sans font-semibold text-[13px] tracking-wide cursor-pointer transition-colors rounded-[3px] disabled:opacity-40 disabled:cursor-not-allowed ${
              sellSide === "YES"
                ? "bg-[#1D7C59] hover:bg-[#166347] text-white"
                : "bg-[#B43C34] hover:bg-[#962F28] text-white"
            }`}
          >
            {submitting
              ? "Submitting to Solana..."
              : isLimitOrder
              ? `Limit Sell ${sellQuantity} ${sellSide === "YES" ? yesLabel : noLabel}`
              : `Sell ${sellQuantity} ${sellSide === "YES" ? yesLabel : noLabel}`}
          </motion.button>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════
          LP TAB
         ════════════════════════════════════════════════════════════════ */
        <div className="space-y-3.5">
          <div className="bg-[#F8F7F4] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] p-3 rounded-[3px] font-mono text-[11px] text-[#555D65] dark:text-[#9AA1AA] leading-relaxed">
            <span className="text-[#1F3A52] dark:text-[#7A9BB5] font-semibold">
              Liquidity Provision (LP)
            </span>
            : Provide seed reserves directly to CPMM AMM pools to earn trading fees on every swap.
          </div>

          {/* Your LP position + market LP pool */}
          {(userLp || marketLpStats) && (
            <div className="bg-[#F8F7F4] dark:bg-[#1A1D21] rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] p-3 space-y-2 text-[11px] font-mono text-[#555D65] dark:text-[#9AA1AA]">
              {userLp && (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-[#1F3A52] dark:text-[#7A9BB5] font-bold">
                    Your Market LP
                  </div>
                  <div className="flex justify-between">
                    <span>Deposited:</span>
                    <span className="text-[#181A1C] dark:text-[#EAE8E3] font-semibold tabular-nums">
                      {Number(userLp.deposited ?? 0).toFixed(2)} SOL
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>LP Tokens:</span>
                    <span className="text-[#1F3A52] dark:text-[#7A9BB5] font-semibold tabular-nums">
                      {Number(userLp.lpShares ?? 0).toLocaleString()} LP
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fees Earned:</span>
                    <span className="text-[#1D7C59] dark:text-[#52B788] font-semibold tabular-nums">
                      {Number(userLp.feesEarned ?? 0) > 0
                        ? `+${Number(userLp.feesEarned).toFixed(3)} SOL`
                        : "—"}
                    </span>
                  </div>
                </>
              )}
              {marketLpStats &&
                Number(marketLpStats.totalLiquiditySol ?? 0) > 0 && (
                  <>
                    {userLp && (
                      <div className="border-t border-[#E2DFD7] dark:border-[#2A2F36] pt-2" />
                    )}
                    <div className="text-[10px] uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-bold">
                      Total Market LP Pool
                    </div>
                    <div className="flex justify-between">
                      <span>Total Liquidity:</span>
                      <span className="text-[#181A1C] dark:text-[#EAE8E3] font-semibold tabular-nums">
                        {Number(marketLpStats.totalLiquiditySol ?? 0).toFixed(
                          2
                        )}{" "}
                        SOL
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total LP Tokens:</span>
                      <span className="text-[#1F3A52] dark:text-[#7A9BB5] font-semibold tabular-nums">
                        {Number(
                          marketLpStats.totalLpTokens ?? 0
                        ).toLocaleString()}{" "}
                        LP
                      </span>
                    </div>
                  </>
                )}
            </div>
          )}

          {/* LP Allocation Mode */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-[#7F8892] dark:text-[#68707B] uppercase tracking-wider">
              LP Pool Allocation
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["balanced", "yes", "no"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLpOption(opt)}
                  className={`py-1.5 px-1 rounded-[3px] text-[10px] font-sans font-semibold uppercase tracking-wider cursor-pointer transition-colors border ${
                    lpOption === opt
                      ? "border-[#1F3A52] dark:border-[#7A9BB5] bg-[#EAE8E3] dark:bg-[#21252A] text-[#1F3A52] dark:text-[#7A9BB5]"
                      : "border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C]"
                  }`}
                >
                  {opt === "balanced"
                    ? "50:50 Split"
                    : opt === "yes"
                    ? "YES Pool"
                    : "NO Pool"}
                </button>
              ))}
            </div>
          </div>

          {/* LP Amount */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-[#7F8892] dark:text-[#68707B] uppercase tracking-wider">
              Liquidity to Deposit (SOL)
            </label>
            <input
              type="number"
              data-testid="lp-amount"
              step="0.5"
              min={0.1}
              value={lpDepositAmount}
              onChange={(e) =>
                setLpDepositAmount(Math.max(0.1, Number(e.target.value)))
              }
              className="w-full bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] px-3 py-1.5 text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52] font-mono font-bold text-[14px]"
            />
          </div>

          {/* LP Impact summary */}
          <div className="bg-[#F8F7F4] dark:bg-[#1A1D21] rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] p-3 space-y-2 text-[11px] font-mono text-[#555D65] dark:text-[#9AA1AA]">
            <div className="flex justify-between">
              <span>Current YES Pool:</span>
              <span className="text-[#181A1C] dark:text-[#EAE8E3] font-semibold tabular-nums">{yesPool.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Current NO Pool:</span>
              <span className="text-[#181A1C] dark:text-[#EAE8E3] font-semibold tabular-nums">{noPool.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between border-t border-[#E2DFD7] dark:border-[#2A2F36] pt-1.5 text-[#1F3A52] dark:text-[#7A9BB5]">
              <span>New YES Pool:</span>
              <span className="font-semibold tabular-nums">{lpNewYesPoolSol.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between text-[#1F3A52] dark:text-[#7A9BB5]">
              <span>New NO Pool:</span>
              <span className="font-semibold tabular-nums">{lpNewNoPoolSol.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between border-t border-[#E2DFD7] dark:border-[#2A2F36] pt-1.5">
              <span>LP Tokens Minted:</span>
              <span className="text-[#1D7C59] dark:text-[#52B788] font-semibold tabular-nums">
                {lpTokensMinted.toLocaleString()} LP
              </span>
            </div>
            <div className="text-[10px] text-[#7F8892] dark:text-[#68707B] leading-snug pt-0.5">
              {lpOption === "balanced"
                ? `1:1 with deposited SOL (${lp.yesAddSol.toFixed(
                    2
                  )} YES + ${lp.noAddSol.toFixed(
                    2
                  )} NO). No fee, no curve — exactly what add_liquidity mints on-chain.`
                : `All ${lpDepositAmount} SOL deposited to the ${lpOption.toUpperCase()} pool only.`}
            </div>
          </div>

          <button
            data-testid="lp-submit"
            disabled={submitting}
            onClick={handleProvideLiquidity}
            className="w-full h-11 rounded-[3px] text-white font-sans font-semibold text-[13px] tracking-wide cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-[#1F3A52] hover:bg-[#16293B]"
          >
            {submitting
              ? "Submitting to Solana..."
              : `Deposit ${lpDepositAmount} SOL Liquidity`}
          </button>
        </div>
      )}
    </div>
  );
}
