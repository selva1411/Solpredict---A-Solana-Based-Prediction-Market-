import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BALANCE_REFRESH_EVENT,
  triggerWalletBalanceRefresh,
} from "./useWalletBalance";

// Ensure window & CustomEvent exist in node test runner
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}
(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, params?: { detail?: any }) {
    this.type = type;
    this.detail = params?.detail;
  }
};

describe("useWalletBalance utilities and event handling", () => {
  it("defines the expected custom event name", () => {
    expect(BALANCE_REFRESH_EVENT).toBe("solpredict:balance-refresh");
  });

  it("triggerWalletBalanceRefresh dispatches the custom event on window", () => {
    const dispatchSpy = vi.fn();
    (globalThis as any).window.dispatchEvent = dispatchSpy;

    triggerWalletBalanceRefresh();

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.type).toBe(BALANCE_REFRESH_EVENT);
  });

  it("calculates correct SOL representation from lamports", () => {
    const lamports = 2_500_000_000; // 2.5 SOL
    const balanceSol = lamports / 1e9;
    expect(balanceSol).toBe(2.5);

    const formatted = balanceSol.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
    expect(formatted).toBe("2.50");
  });

  it("correctly identifies low balance threshold for transaction gas warnings", () => {
    const isLowBalance = (balSol: number | null) => balSol !== null && balSol < 0.05;

    expect(isLowBalance(0.01)).toBe(true);
    expect(isLowBalance(0.049)).toBe(true);
    expect(isLowBalance(0.05)).toBe(false);
    expect(isLowBalance(1.5)).toBe(false);
    expect(isLowBalance(null)).toBe(false);
  });

  it("calculates maximum buy shares correctly while reserving gas", () => {
    const calculateMaxBuy = (balanceSol: number | null, sharePriceSol: number) => {
      if (balanceSol === null || balanceSol <= 0.015) return 0;
      const availableSpendSol = Math.max(0, balanceSol - 0.01);
      const price = sharePriceSol > 0 ? sharePriceSol : 0.01;
      return Math.max(1, Math.floor(availableSpendSol / price));
    };

    // User has 1.01 SOL, share price is 0.1 SOL -> 1.0 SOL spendable -> 10 shares
    expect(calculateMaxBuy(1.01, 0.1)).toBe(10);

    // User has tiny balance (<= 0.015) -> 0 shares
    expect(calculateMaxBuy(0.012, 0.1)).toBe(0);

    // Disconnected / null balance -> 0 shares
    expect(calculateMaxBuy(null, 0.1)).toBe(0);
  });

  it("calculates maximum LP deposit correctly while reserving gas", () => {
    const calculateMaxLp = (balanceSol: number | null) => {
      if (balanceSol === null || balanceSol <= 0.015) return 0.1;
      const available = Math.max(0.1, Math.floor((balanceSol - 0.01) * 100) / 100);
      return Number(available.toFixed(2));
    };

    expect(calculateMaxLp(2.515)).toBe(2.5);
    expect(calculateMaxLp(0.01)).toBe(0.1);
    expect(calculateMaxLp(null)).toBe(0.1);
  });

  it("forceWalletBalanceRefresh dispatches event with forceOnChain: true", async () => {
    const { forceWalletBalanceRefresh } = await import("./useWalletBalance");
    const dispatchSpy = vi.fn();
    (globalThis as any).window.dispatchEvent = dispatchSpy;

    forceWalletBalanceRefresh();

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.type).toBe(BALANCE_REFRESH_EVENT);
    expect(event.detail?.forceOnChain).toBe(true);
  });
});
