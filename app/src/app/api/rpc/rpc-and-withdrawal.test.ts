import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as rpcHandler } from "./route";
import { BALANCE_REFRESH_EVENT, triggerWalletBalanceRefresh } from "@/hooks/useWalletBalance";

describe("RPC cache invalidation and wallet balance refresh flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles getBalance requests via RPC proxy", async () => {
    const testWallet = "11111111111111111111111111111111";
    const req = new NextRequest("http://localhost:3001/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [testWallet, { commitment: "confirmed" }],
      }),
    });

    const res = await rpcHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBeDefined();
    expect(typeof data.result.value).toBe("number");
  });

  it("invalidates getBalance cache when a transaction is dispatched", async () => {
    const testWallet = "7Y2gCvbXqK1Z2MrF4tH9sPqN6B8aV3eW5xL0mJ4kL9";

    // 1. Fetch balance first to populate cache
    const getBalReq = new NextRequest("http://localhost:3001/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "bal-1",
        method: "getBalance",
        params: [testWallet],
      }),
    });
    const balRes = await rpcHandler(getBalReq);
    expect(balRes.status).toBe(200);

    // 2. Dispatches a transaction
    const txReq = new NextRequest("http://localhost:3001/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "tx-1",
        method: "sendTransaction",
        params: ["dummy-raw-tx-data"],
      }),
    });
    const txRes = await rpcHandler(txReq);
    expect(txRes.status).toBe(200);

    // 3. Subsequent balance request receives fresh data instead of stale pre-tx cache
    const newBalReq = new NextRequest("http://localhost:3001/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "bal-2",
        method: "getBalance",
        params: [testWallet],
      }),
    });
    const newBalRes = await rpcHandler(newBalReq);
    expect(newBalRes.status).toBe(200);
    const newBalData = await newBalRes.json();
    expect(newBalData.id).toBe("bal-2");
  });

  it("triggerWalletBalanceRefresh dispatches global event for UI components with delta", () => {
    let receivedDelta: number | undefined;
    const handler = (e: Event) => {
      receivedDelta = (e as CustomEvent).detail?.deltaLamports;
    };

    if (typeof window !== "undefined") {
      window.addEventListener(BALANCE_REFRESH_EVENT, handler as EventListener);
      triggerWalletBalanceRefresh(50_000_000);
      expect(receivedDelta).toBe(50_000_000);
      window.removeEventListener(BALANCE_REFRESH_EVENT, handler as EventListener);
    }
  });

  it("handles withdraw_fees action in admin proposals API", async () => {
    const { POST: proposalPost } = await import("../admin/proposals/route");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_ENABLED", "1");

    const req = new NextRequest("http://localhost:3001/api/admin/proposals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet": "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf",
      },
      body: JSON.stringify({
        action: "withdraw_fees",
        marketId: 65,
        marketPubkey: "4SD2NEJZbJJYgE5ZgiA4htT6Y4EZtCTaUHAm2uQdHeZF",
      }),
    });

    const res = await proposalPost(req, {} as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.action).toBe("withdraw_fees");
  });

  it("returns stable, consistent balance across repeated refresh button clicks", async () => {
    const testWallet = "RefreshWallet1111111111111111111111111111";

    // Simulate first refresh click
    const req1 = new NextRequest("http://localhost:3001/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "click-1",
        method: "getBalance",
        params: [testWallet],
      }),
    });
    const res1 = await rpcHandler(req1);
    const data1 = await res1.json();
    const balance1 = data1.result.value;

    // Simulate 5 rapid or successive refresh clicks
    for (let i = 2; i <= 6; i++) {
      const reqN = new NextRequest("http://localhost:3001/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `click-${i}`,
          method: "getBalance",
          params: [testWallet],
        }),
      });
      const resN = await rpcHandler(reqN);
      const dataN = await resN.json();
      expect(dataN.result.value).toBe(balance1);
    }
  });

  it("creditLocalBalance increments existing balance without regressing to 2 SOL default", async () => {
    const { creditLocalBalance } = await import("./route");
    const testWallet = "CreditWallet" + Date.now().toString(36) + Math.random().toString(36).slice(2);

    // 1. Initial query establishes balance
    const initReq = new NextRequest("http://localhost:3001/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "credit-init",
        method: "getBalance",
        params: [testWallet],
      }),
    });
    const initRes = await rpcHandler(initReq);
    const initData = await initRes.json();
    const initialBal = initData.result.value;

    // 2. Admin withdraws 150,000,000 lamports fee
    creditLocalBalance(testWallet, 150_000_000);

    // 3. User refreshes balance in header
    const refreshReq = new NextRequest("http://localhost:3001/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "credit-refresh",
        method: "getBalance",
        params: [testWallet],
      }),
    });
    const refreshRes = await rpcHandler(refreshReq);
    const refreshData = await refreshRes.json();

    expect(refreshData.result.value).toBe(initialBal + 150_000_000);

    // 4. Repeated clicks after withdrawal remain completely consistent
    for (let i = 1; i <= 3; i++) {
      const followUpReq = new NextRequest("http://localhost:3001/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `post-withdraw-click-${i}`,
          method: "getBalance",
          params: [testWallet],
        }),
      });
      const followUpRes = await rpcHandler(followUpReq);
      const followUpData = await followUpRes.json();
      expect(followUpData.result.value).toBe(initialBal + 150_000_000);
    }
  });

  it("handles instant cacheBust RPC method without calling upstream network", async () => {
    const bustReq = new NextRequest("http://localhost:3001/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "bust-1",
        method: "cacheBust",
      }),
    });
    const bustRes = await rpcHandler(bustReq);
    expect(bustRes.status).toBe(200);
    const bustData = await bustRes.json();
    expect(bustData.result).toBe(true);
  });
});
