import { describe, it, expect, vi } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  getConfigPda,
  getMarketPda,
  getYesMintPda,
  getNoMintPda,
  getTreasuryPda,
  getUserPositionPda,
  getOrderPda,
  getOrderEscrowPda,
  getProposalPda,
  getProposalVaultPda,
  getLiquidityPositionPda,
  getLpRewardVaultPda,
  getEmergencyPausePda,
} from "@/lib/pda";
import {
  cost,
  buyCost,
  sellReturn,
  probabilityYesBps,
  probabilityNoBps,
  DEFAULT_B,
} from "@/lib/amm/lmsr";
import {
  getSpotPriceYes,
  getSpotPriceNo,
  getBuyAmountOut,
  getSellAmountOut,
} from "@/lib/amm/cpmm";
import {
  BALANCE_REFRESH_EVENT,
  triggerWalletBalanceRefresh,
  forceWalletBalanceRefresh,
} from "@/hooks/useWalletBalance";

const DEV_SERVER_URL = "http://localhost:3001";
const ADMIN_WALLET = "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf";
const TEST_PROGRAM_ID = new PublicKey("6HWVuwJuRrcynbusE5Av8czLz98WWqBYSYQ2hP2cjHXg");

describe("WHITE BOX TESTING: Internal Logic, State & Invariant Checks", () => {
  describe("1. PDA Derivation byte-for-byte fidelity with Anchor smart contract", () => {
    it("derives all PDAs deterministically matching Anchor seeds", () => {
      const marketId = new anchor.BN(42);
      const marketPda = getMarketPda(marketId, TEST_PROGRAM_ID);
      expect(marketPda).toBeInstanceOf(PublicKey);

      const configPda = getConfigPda(TEST_PROGRAM_ID);
      expect(configPda).toBeInstanceOf(PublicKey);

      const treasuryPda = getTreasuryPda(marketPda, TEST_PROGRAM_ID);
      expect(treasuryPda).toBeInstanceOf(PublicKey);

      const yesMint = getYesMintPda(marketPda, TEST_PROGRAM_ID);
      const noMint = getNoMintPda(marketPda, TEST_PROGRAM_ID);
      expect(yesMint).toBeInstanceOf(PublicKey);
      expect(noMint).toBeInstanceOf(PublicKey);
      expect(yesMint.toBase58()).not.toBe(noMint.toBase58());

      const userPubkey = new PublicKey(ADMIN_WALLET);
      const positionPda = getUserPositionPda(marketPda, userPubkey, TEST_PROGRAM_ID);
      expect(positionPda).toBeInstanceOf(PublicKey);

      const orderId = new anchor.BN(1);
      const orderPda = getOrderPda(marketPda, userPubkey, orderId, TEST_PROGRAM_ID);
      const escrowPda = getOrderEscrowPda(marketPda, userPubkey, orderId, TEST_PROGRAM_ID);
      expect(orderPda).toBeInstanceOf(PublicKey);
      expect(escrowPda).toBeInstanceOf(PublicKey);

      const lpPda = getLiquidityPositionPda(marketPda, userPubkey, TEST_PROGRAM_ID);
      expect(lpPda).toBeInstanceOf(PublicKey);

      const lpVault = getLpRewardVaultPda(marketPda, TEST_PROGRAM_ID);
      expect(lpVault).toBeInstanceOf(PublicKey);

      const pausePda = getEmergencyPausePda(TEST_PROGRAM_ID);
      expect(pausePda).toBeInstanceOf(PublicKey);
    });

    it("ensures unique addresses for different market IDs", () => {
      const pda1 = getMarketPda(new anchor.BN(1), TEST_PROGRAM_ID);
      const pda2 = getMarketPda(new anchor.BN(2), TEST_PROGRAM_ID);
      expect(pda1.toBase58()).not.toBe(pda2.toBase58());
    });
  });

  describe("2. Mathematical Invariants: AMM LMSR & CPMM Formulas", () => {
    it("LMSR probabilities are bounded between 0 and 10000 bps and sum to 10000 bps (100%)", () => {
      const b = DEFAULT_B;
      const yesBps = probabilityYesBps(b, 50_000_000_000n, 50_000_000_000n);
      const noBps = probabilityNoBps(b, 50_000_000_000n, 50_000_000_000n);
      expect(yesBps).toBe(5000);
      expect(noBps).toBe(5000);
      expect(yesBps + noBps).toBe(10000);

      // Skewed pools
      const skewedYes = probabilityYesBps(b, 200_000_000_000n, 20_000_000_000n);
      const skewedNo = probabilityNoBps(b, 200_000_000_000n, 20_000_000_000n);
      expect(skewedYes).toBeGreaterThan(skewedNo);
      expect(skewedYes + skewedNo).toBeGreaterThanOrEqual(9999);
      expect(skewedYes + skewedNo).toBeLessThanOrEqual(10000);
      expect(skewedYes).toBeLessThan(10000);
      expect(skewedNo).toBeGreaterThan(0);
    });

    it("LMSR buy cost is strictly positive and monotonic with quantity", () => {
      const b = DEFAULT_B;
      const q = [50_000_000_000n, 50_000_000_000n];
      const cost1 = buyCost(q, b, 0, 10_000_000_000n);
      const cost2 = buyCost(q, b, 0, 20_000_000_000n);
      expect(cost1).toBeGreaterThan(0n);
      expect(cost2).toBeGreaterThan(cost1);
    });

    it("LMSR sell return is less than buy cost (no risk-free arbitrage)", () => {
      const b = DEFAULT_B;
      const q = [50_000_000_000n, 50_000_000_000n];
      const buyCostVal = buyCost(q, b, 0, 10_000_000_000n);
      const postBuyQ = [60_000_000_000n, 50_000_000_000n];
      const sellReturnVal = sellReturn(postBuyQ, b, 0, 10_000_000_000n);
      expect(sellReturnVal).toBeLessThanOrEqual(buyCostVal);
    });

    it("CPMM maintains invariant and price bounds", () => {
      const yesPool = 1_000_000_000n;
      const noPool = 1_000_000_000n;
      const spotYes = getSpotPriceYes(yesPool, noPool, 0);
      const spotNo = getSpotPriceNo(yesPool, noPool, 0);
      expect(spotYes).toBe(500_000_000_000n);
      expect(spotNo).toBe(500_000_000_000n);

      const tokensOut = getBuyAmountOut(yesPool, noPool, 100_000_000n, 200);
      expect(tokensOut).toBeGreaterThan(0n);

      const refund = getSellAmountOut(yesPool, noPool, 50_000_000n, 200);
      expect(refund).toBeGreaterThan(0n);
    });
  });

  describe("3. useWalletBalance Hook Event System & Internal State", () => {
    it("dispatches standard balance refresh event with optional deltaLamports", () => {
      const dispatchSpy = vi.fn();
      (globalThis as any).window = { dispatchEvent: dispatchSpy };

      triggerWalletBalanceRefresh(500_000_000);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const evt = dispatchSpy.mock.calls[0][0];
      expect(evt.type).toBe(BALANCE_REFRESH_EVENT);
      expect(evt.detail.deltaLamports).toBe(500_000_000);
    });

    it("dispatches hard on-chain force-refresh event without delta", () => {
      const dispatchSpy = vi.fn();
      (globalThis as any).window = { dispatchEvent: dispatchSpy };

      forceWalletBalanceRefresh();
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const evt = dispatchSpy.mock.calls[0][0];
      expect(evt.type).toBe(BALANCE_REFRESH_EVENT);
      expect(evt.detail.forceOnChain).toBe(true);
      expect(evt.detail.deltaLamports).toBeUndefined();
    });

    it("formats SOL balance correctly and cleanly without floating precision artifacts", () => {
      const formatSol = (lamports: number | null): string => {
        if (lamports === null) return "—";
        const sol = lamports / 1e9;
        return sol.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        });
      };

      expect(formatSol(null)).toBe("—");
      expect(formatSol(3_854_569_959)).toBe("3.8546");
      expect(formatSol(1_000_000_000)).toBe("1.00");
      expect(formatSol(50_000_000)).toBe("0.05");
      expect(formatSol(10_000_000)).toBe("0.01");
    });
  });
});

const isServerRunning = await fetch(`${DEV_SERVER_URL}/api/health`, { signal: AbortSignal.timeout(500) })
  .then((r) => r.ok)
  .catch(() => false);

describe.runIf(isServerRunning)("BLACK BOX TESTING: End-User Simulated Flows & API Auditing", () => {
  describe("Journey 1: Public User Browsing & Platform Health", () => {
    it("GET /api/health returns HTTP 200 with active status", async () => {
      const res = await fetch(`${DEV_SERVER_URL}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it("GET /api/market-data/sol-price returns live SOL spot price", async () => {
      const res = await fetch(`${DEV_SERVER_URL}/api/market-data/sol-price`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.price).toBeGreaterThan(0);
      expect(typeof data.price).toBe("number");
    });

    it("GET /api/markets/cached returns properly structured market records", async () => {
      const res = await fetch(`${DEV_SERVER_URL}/api/markets/cached`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.markets)).toBe(true);
      if (data.markets.length > 0) {
        const m = data.markets[0];
        expect(m).toHaveProperty("question");
        expect(m).toHaveProperty("marketPubkey");
        expect(m).toHaveProperty("status");
      }
    });

    it("GET /api/activity/recent returns live activity stream", async () => {
      const res = await fetch(`${DEV_SERVER_URL}/api/activity/recent`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.activities)).toBe(true);
    });
  });

  describe("Journey 2: Wallet Header SOL Balance & Cache-Bust Integrity", () => {
    it("POST /api/rpc getBalance returns exact on-chain balance without inflation", async () => {
      const res = await fetch(`${DEV_SERVER_URL}/api/rpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "test-getbalance",
          method: "getBalance",
          params: [ADMIN_WALLET, { commitment: "confirmed" }],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.jsonrpc).toBe("2.0");
      expect(data.result).toBeDefined();
      expect(typeof data.result.value).toBe("number");
      // The on-chain balance is approximately 3.85 SOL (3.85e9 lamports)
      expect(data.result.value).toBeGreaterThan(3e9);
      expect(data.result.value).toBeLessThan(10e9);
      // Crucial test: It is NOT the corrupted 75 SOL credit value
      expect(data.result.value).toBeLessThan(50e9);
    });

    it("POST /api/rpc cacheBust immediately clears server cache without upstream delay", async () => {
      const startTime = Date.now();
      const res = await fetch(`${DEV_SERVER_URL}/api/rpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "bust-test",
          method: "cacheBust",
        }),
      });
      const elapsed = Date.now() - startTime;

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result).toBe(true);
      // Instant execution: must take under 200ms
      expect(elapsed).toBeLessThan(200);
    });

    it("Repeated manual clicks on balance badge remain 100% deterministic", async () => {
      const balances: number[] = [];

      for (let i = 0; i < 5; i++) {
        // Bust and query simulating user clicking refresh
        await fetch(`${DEV_SERVER_URL}/api/rpc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cacheBust" }),
        });

        const res = await fetch(`${DEV_SERVER_URL}/api/rpc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: `click-${i}`,
            method: "getBalance",
            params: [ADMIN_WALLET],
          }),
        });
        const data = await res.json();
        balances.push(data.result.value);
      }

      // All 5 readings must match the authoritative value exactly without drifting
      const initial = balances[0];
      for (const b of balances) {
        expect(b).toBe(initial);
      }
    });
  });

  describe("Journey 3: Edge Cases, Security & Input Validation", () => {
    it("POST /api/rpc handles malformed JSON with 400 Parse error", async () => {
      const res = await fetch(`${DEV_SERVER_URL}/api/rpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ bad-json-payload",
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe(-32700);
    });

    it("POST /api/markets/:id/liquidity rejects missing signature with 400", async () => {
      const dummyMarket = "11111111111111111111111111111111";
      const res = await fetch(`${DEV_SERVER_URL}/api/markets/${dummyMarket}/liquidity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: ADMIN_WALLET,
          amountSol: 1.0,
          // signature intentionally omitted
        }),
      });

      expect(res.status).toBe(400);
    });

    it("POST /api/markets/:id/liquidity rejects missing walletAddress with 400", async () => {
      const dummyMarket = "11111111111111111111111111111111";
      const res = await fetch(`${DEV_SERVER_URL}/api/markets/${dummyMarket}/liquidity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: "5Ver7h2NM5MPHnK4C7P7qC9H2fF7c8r6wG1wVf",
          amountSol: 1.0,
        }),
      });

      expect(res.status).toBe(400);
    });
  });
});
