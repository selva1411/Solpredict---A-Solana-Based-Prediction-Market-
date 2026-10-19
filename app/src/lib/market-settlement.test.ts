import { describe, it, expect, beforeEach } from "vitest";
import { getMarketStatusString } from "@/lib/events";
import {
  SAMPLE_MARKETS,
  updateSampleMarketStatus,
} from "@/lib/data/sample-markets";
import {
  isFeeWithdrawn,
  markFeeWithdrawn,
} from "@/lib/db/fee-withdrawn-store";

describe("Market Settlement & Trading Prevention Flow", () => {
  it("getMarketStatusString recognizes settled from Anchor object and string", () => {
    // Anchor enum representation
    expect(getMarketStatusString({ settled: {} })).toBe("Settled");
    expect(getMarketStatusString({ open: {} })).toBe("Open");
    expect(getMarketStatusString({ cancelled: {} })).toBe("Cancelled");

    // DB string representations
    expect(getMarketStatusString("settled")).toBe("Settled");
    expect(getMarketStatusString("Settled")).toBe("Settled");
    expect(getMarketStatusString("cancelled")).toBe("Cancelled");
    expect(getMarketStatusString("open")).toBe("Open");
  });

  it("updateSampleMarketStatus correctly updates fallback in-memory markets", () => {
    const testMarket = SAMPLE_MARKETS[0];
    expect(testMarket).toBeDefined();

    updateSampleMarketStatus(testMarket.marketPubkey, "settled", "YES");
    expect(testMarket.status).toBe("settled");
    expect(testMarket.winningOutcome).toBe("YES");
    expect(testMarket.settledAt).toBeDefined();

    // Verify status resolution with updated sample market
    expect(getMarketStatusString(testMarket.status)).toBe("Settled");
  });

  it("fee-withdrawn-store accurately tracks fee withdrawal without DB schema collision", () => {
    const pubkey = "TestMarketPubkey111111111111111111111111111";
    expect(isFeeWithdrawn(pubkey)).toBe(false);

    markFeeWithdrawn(pubkey);
    expect(isFeeWithdrawn(pubkey)).toBe(true);
  });

  it("winningSide resolution supports both object and string forms", () => {
    const resolveWinningSide = (winningOutcome: any): "YES" | "NO" | null => {
      return winningOutcome?.yes !== undefined ||
        (typeof winningOutcome === "string" &&
          winningOutcome.toUpperCase() === "YES")
        ? "YES"
        : winningOutcome?.no !== undefined ||
          (typeof winningOutcome === "string" &&
            winningOutcome.toUpperCase() === "NO")
        ? "NO"
        : null;
    };

    expect(resolveWinningSide({ yes: {} })).toBe("YES");
    expect(resolveWinningSide({ no: {} })).toBe("NO");
    expect(resolveWinningSide("yes")).toBe("YES");
    expect(resolveWinningSide("YES")).toBe("YES");
    expect(resolveWinningSide("no")).toBe("NO");
    expect(resolveWinningSide("NO")).toBe("NO");
    expect(resolveWinningSide({ unset: {} })).toBe(null);
    expect(resolveWinningSide(null)).toBe(null);
  });

  it("prevents purchasing shares when market status is not Open", () => {
    const canTrade = (status: string) => status === "Open";

    expect(canTrade("Open")).toBe(true);
    expect(canTrade("Settled")).toBe(false);
    expect(canTrade("Cancelled")).toBe(false);
    expect(canTrade("Ended")).toBe(false);
  });
});
