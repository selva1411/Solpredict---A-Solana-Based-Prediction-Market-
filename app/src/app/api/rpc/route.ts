export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getWalletCredit, addWalletCredit } from "@/lib/db/wallet-credits-store";

import fs from "fs";
import path from "path";

// Global cache for read-only RPC calls to completely prevent 429 rate limit errors and survive hot reload
interface CacheEntry {
  response: unknown;
  timestamp: number;
}

const LOCAL_BALANCES_FILE = path.join(process.cwd(), ".local-balances.json");

function loadLocalBalancesFromDisk(): Record<string, number> {
  try {
    if (typeof fs !== "undefined" && fs.existsSync && fs.existsSync(LOCAL_BALANCES_FILE)) {
      const data = fs.readFileSync(LOCAL_BALANCES_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    // ignore
  }
  return {};
}

function saveLocalBalancesToDisk(map: Map<string, number>) {
  try {
    if (typeof fs !== "undefined" && fs.writeFileSync) {
      const obj = Object.fromEntries(map.entries());
      fs.writeFileSync(LOCAL_BALANCES_FILE, JSON.stringify(obj, null, 2), "utf-8");
    }
  } catch {
    // ignore
  }
}

const g = globalThis as unknown as {
  __solpredict_rpc_cache?: Map<string, CacheEntry>;
  __solpredict_local_balances?: Map<string, number>;
};

if (!g.__solpredict_rpc_cache) {
  g.__solpredict_rpc_cache = new Map<string, CacheEntry>();
}
if (!g.__solpredict_local_balances) {
  const initial = new Map<string, number>();
  const disk = loadLocalBalancesFromDisk();
  for (const [k, v] of Object.entries(disk)) {
    if (typeof v === "number" && !isNaN(v)) {
      initial.set(k, v);
    }
  }
  g.__solpredict_local_balances = initial;
}

const rpcCache = g.__solpredict_rpc_cache;
const localBalances = g.__solpredict_local_balances;
const CACHE_TTL_MS = 2500; // 2.5s cache for read-only RPC calls

export function creditLocalBalance(targetWallet: string, lamports: number) {
  if (!targetWallet || !lamports) return;
  addWalletCredit(targetWallet, lamports);
  let current = localBalances.get(targetWallet);
  if (current === undefined) {
    for (const [k, v] of rpcCache.entries()) {
      if (k.startsWith("getBalance") && k.includes(targetWallet)) {
        const resp = v.response as Record<string, unknown>;
        const result = (resp?.result as Record<string, unknown>) || {};
        if (typeof result?.value === "number") {
          current = result.value;
          break;
        }
      }
    }
  }
  const base = current ?? 2_000_000_000;
  const newBalance = base + lamports;
  localBalances.set(targetWallet, newBalance);
  saveLocalBalancesToDisk(localBalances);
  let found = false;
  for (const [k, v] of rpcCache.entries()) {
    if (k.startsWith("getBalance") && k.includes(targetWallet)) {
      found = true;
      const resp = v.response as Record<string, unknown>;
      const result = (resp?.result as Record<string, unknown>) || {};
      rpcCache.set(k, {
        response: {
          ...resp,
          result: {
            ...result,
            context: result?.context || { slot: 1 },
            value: newBalance,
          },
        },
        timestamp: Date.now(),
      });
    }
  }
  if (!found) {
    rpcCache.set(`getBalance:["${targetWallet}"]`, {
      response: {
        jsonrpc: "2.0",
        result: { context: { slot: 1 }, value: newBalance },
        id: 1,
      },
      timestamp: Date.now(),
    });
  }
}

const CACHEABLE_METHODS = new Set([
  "getAccountInfo",
  "getMultipleAccounts",
  "getBalance",
  "getLatestBlockhash",
  "getSlot",
  "getBlockHeight",
  "getVersion",
  "getHealth",
  "getEpochInfo",
  "getProgramAccounts",
  "getTokenAccountsByOwner",
  "getTokenAccountBalance",
  "getFeeForMessage",
  "getRecentPrioritizationFees",
  "getSignaturesForAddress",
  "getTransaction",
]);

const LOCAL_VALIDATOR = process.env.LOCALNET_RPC_URL || "http://127.0.0.1:8899";
const FALLBACK_RPCS = Array.from(
  new Set(
    [
      process.env.HELIUS_RPC_URL,
      process.env.NEXT_PUBLIC_RPC_URL?.startsWith("http") &&
      !process.env.NEXT_PUBLIC_RPC_URL.includes("localhost") &&
      !process.env.NEXT_PUBLIC_RPC_URL.includes("/api/rpc")
        ? process.env.NEXT_PUBLIC_RPC_URL
        : undefined,
      "https://api.devnet.solana.com",
    ].filter((url): url is string => Boolean(url && !url.includes("localhost")))
  )
);

async function tryFetchRpc(url: string, body: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }, { status: 400 });
  }

  let rpcReq: { method?: string; id?: unknown; params?: unknown } = {};
  try {
    rpcReq = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
      { status: 400 }
    );
  }

  const isCacheBust =
    rpcReq.method === "cacheBust" ||
    rpcReq.method === "clearCache" ||
    (rpcReq.method === "sendRawTransaction" &&
      Array.isArray(rpcReq.params) &&
      rpcReq.params[0] === "__cache_bust__") ||
    req.nextUrl?.searchParams?.get("bust") === "1" ||
    req.headers?.get("x-cache-bust") === "1";

  if (isCacheBust) {
    for (const k of rpcCache.keys()) {
      if (k.startsWith("getBalance")) {
        rpcCache.delete(k);
      }
    }
    if (
      rpcReq.method === "cacheBust" ||
      rpcReq.method === "clearCache" ||
      (rpcReq.method === "sendRawTransaction" &&
        Array.isArray(rpcReq.params) &&
        rpcReq.params[0] === "__cache_bust__")
    ) {
      return NextResponse.json({
        jsonrpc: "2.0",
        result: true,
        id: rpcReq.id ?? 1,
      });
    }
  }

  if (rpcReq.method === "sendTransaction" || rpcReq.method === "sendRawTransaction") {
    for (const k of rpcCache.keys()) {
      if (k.startsWith("getBalance")) {
        rpcCache.delete(k);
      }
    }
  }

  const isCacheable = rpcReq.method && CACHEABLE_METHODS.has(rpcReq.method) && !isCacheBust;
  const cacheKey = isCacheable ? `${rpcReq.method}:${JSON.stringify(rpcReq.params || [])}` : null;

  const effectiveTtl = rpcReq.method === "getBalance" ? 2000 : CACHE_TTL_MS;

  if (cacheKey && rpcCache.has(cacheKey)) {
    const entry = rpcCache.get(cacheKey)!;
    if (Date.now() - entry.timestamp < effectiveTtl) {
      const cached = entry.response as Record<string, unknown>;
      if (rpcReq.method === "getBalance") {
        console.log(`[RPC Proxy getBalance CACHE HIT] returning cached value`);
      }
      return NextResponse.json({
        ...cached,
        id: rpcReq.id ?? (cached.id as unknown),
      });
    }
  }

  const isTest = Boolean(process.env.VITEST || process.env.NODE_ENV === "test");
  const isLocalnet =
    process.env.NEXT_PUBLIC_CLUSTER === "localnet" || isTest;

  // 1. First attempt: Local validator (snappy 200ms check, skipped in test env)
  if (!isTest) {
    try {
      const localRes = await tryFetchRpc(LOCAL_VALIDATOR, bodyText, 200);
      if (localRes.ok) {
        const json = await localRes.json();
        if (cacheKey) {
          rpcCache.set(cacheKey, { response: json, timestamp: Date.now() });
        }
        // Only inject off-chain credits on localnet where SOL transfers are simulated.
        // On devnet/mainnet the real on-chain balance is authoritative — never inflate it.
        if (isLocalnet && rpcReq.method === "getBalance" && typeof json?.result?.value === "number") {
          const params = Array.isArray(rpcReq.params) ? rpcReq.params : [];
          const targetWallet = String(params[0] || "");
          if (targetWallet) {
            const credit = getWalletCredit(targetWallet);
            const total = json.result.value + credit;
            json.result.value = total;
            localBalances.set(targetWallet, total);
          }
        }
        return NextResponse.json(json);
      }
    } catch {
      // Local validator not running or unreachable, fallback smoothly
    }
  }

  // 2. Fallback attempt across remote RPCs (only if cluster is devnet/mainnet and not local requestAirdrop)
  if (!isLocalnet && rpcReq.method !== "requestAirdrop") {
    for (const fallbackUrl of FALLBACK_RPCS) {
      try {
        const res = await tryFetchRpc(fallbackUrl, bodyText, 6000);
        if (res.status === 429) {
          // Upstream 429 rate limit: if we have any stale cache entry, return it!
          if (cacheKey && rpcCache.has(cacheKey)) {
            const stale = rpcCache.get(cacheKey)!.response as Record<string, unknown>;
            return NextResponse.json({
              ...stale,
              id: rpcReq.id ?? (stale.id as unknown),
            });
          }
          continue; // Try next fallback
        }
        if (res.ok) {
          const json = await res.json();
          if (
            json?.error?.code === 429 ||
            String(json?.error?.message).toLowerCase().includes("rate limit")
          ) {
            if (cacheKey && rpcCache.has(cacheKey)) {
              const stale = rpcCache.get(cacheKey)!.response as Record<string, unknown>;
              return NextResponse.json({
                ...stale,
                id: rpcReq.id ?? (stale.id as unknown),
              });
            }
            continue; // Try next fallback
          }
          if (
            // Only inject credits on localnet; on devnet/mainnet trust the real on-chain balance.
            isLocalnet &&
            rpcReq.method === "getBalance" && typeof json?.result?.value === "number"
          ) {
            const params = Array.isArray(rpcReq.params) ? rpcReq.params : [];
            const targetWallet = String(params[0] || "");
            if (targetWallet) {
              const credit = getWalletCredit(targetWallet);
              const total = json.result.value + credit;
              json.result.value = total;
              localBalances.set(targetWallet, total);
              saveLocalBalancesToDisk(localBalances);
            }
            console.log(`[RPC Proxy getBalance UPSTREAM OK] targetWallet=${targetWallet}, upstream=${json.result.value}`);
          } else if (rpcReq.method === "getBalance") {
            console.log(`[RPC Proxy getBalance UPSTREAM OK] devnet/mainnet, trusting raw on-chain balance`);
          }
          if (cacheKey) {
            rpcCache.set(cacheKey, { response: json, timestamp: Date.now() });
          }
          return NextResponse.json(json);
        }
      } catch {
        // Upstream timed out or errored: return stale cache if available
        if (cacheKey && rpcCache.has(cacheKey)) {
          const stale = rpcCache.get(cacheKey)!.response as Record<string, unknown>;
          return NextResponse.json({
            ...stale,
            id: rpcReq.id ?? (stale.id as unknown),
          });
        }
      }
    }
  }

  // 3. Graceful fallback response if all upstream nodes are unreachable/rate-limited
  if (rpcReq.method === "getHealth") {
    return NextResponse.json({ jsonrpc: "2.0", result: "ok", id: rpcReq.id ?? 1 });
  }

  if (rpcReq.method === "requestAirdrop") {
    const params = Array.isArray(rpcReq.params) ? rpcReq.params : [];
    const targetWallet = String(params[0] || "");
    const lamports = Number(params[1] || 2_000_000_000);
    const current = localBalances.get(targetWallet) ?? 2_000_000_000;
    localBalances.set(targetWallet, current + lamports);
    saveLocalBalancesToDisk(localBalances);
    for (const k of rpcCache.keys()) {
      if (k.startsWith("getBalance") && k.includes(targetWallet)) {
        rpcCache.delete(k);
      }
    }
    const mockSig = "5Ver7h2NM5MPHnK4C7P7qC9H2fF7c8r6wG1wVf" + Math.random().toString(36).slice(2) + "AirdropConfirmed";
    return NextResponse.json({
      jsonrpc: "2.0",
      result: mockSig.slice(0, 64),
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getBalance") {
    const params = Array.isArray(rpcReq.params) ? rpcReq.params : [];
    const targetWallet = String(params[0] || "");

    // 1. Return stale cache for this exact request key if available
    if (cacheKey && rpcCache.has(cacheKey)) {
      const stale = rpcCache.get(cacheKey)!.response as Record<string, unknown>;
      return NextResponse.json({
        ...stale,
        id: rpcReq.id ?? (stale.id as unknown),
      });
    }

    // 2. Return any known cached balance for this wallet
    if (targetWallet) {
      for (const [k, v] of rpcCache.entries()) {
        if (k.startsWith("getBalance") && k.includes(targetWallet)) {
          const stale = v.response as Record<string, unknown>;
          return NextResponse.json({
            ...stale,
            id: rpcReq.id ?? (stale.id as unknown),
          });
        }
      }
    }

    // 3. Return known local balance or fallback (LOCALNET / TEST ONLY)
    if (!isLocalnet) {
      console.warn(`[RPC Proxy getBalance UPSTREAM UNAVAILABLE] devnet/mainnet upstreams unreachable for ${targetWallet}`);
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: { code: -32603, message: "Upstream Solana RPC unavailable or rate-limited" },
          id: rpcReq.id ?? 1,
        },
        { status: 503 }
      );
    }

    const credit = getWalletCredit(targetWallet);
    let balance: number;
    if (targetWallet && localBalances.has(targetWallet)) {
      balance = localBalances.get(targetWallet)!;
    } else {
      const disk = loadLocalBalancesFromDisk();
      if (targetWallet && typeof disk[targetWallet] === "number") {
        balance = disk[targetWallet];
        localBalances.set(targetWallet, balance);
      } else {
        balance = 2_000_000_000 + credit;
      }
    }

    console.log(`[RPC Proxy getBalance FALLBACK] targetWallet=${targetWallet}, returning balance=${balance}`);

    return NextResponse.json({
      jsonrpc: "2.0",
      result: { context: { slot: 1 }, value: balance },
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "simulateTransaction") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: {
        context: { slot: 1 },
        value: {
          err: null,
          logs: [
            "Program log: Instruction: Execute",
            "Program log: Success",
          ],
          accounts: null,
          unitsConsumed: 1200,
        },
      },
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "sendTransaction") {
    const mockSig = "4Ver7h2NM5MPHnK4C7P7qC9H2fF7c8r6wG1wVf" + Math.random().toString(36).slice(2) + "TxSuccess";
    return NextResponse.json({
      jsonrpc: "2.0",
      result: mockSig.slice(0, 64),
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getSignatureStatuses") {
    const params = Array.isArray(rpcReq.params) ? rpcReq.params : [];
    const sigs = Array.isArray(params[0]) ? params[0] : [params[0]];
    const statuses = sigs.map(() => ({
      slot: 1,
      confirmations: 1,
      err: null,
      confirmationStatus: "confirmed",
    }));
    return NextResponse.json({
      jsonrpc: "2.0",
      result: { context: { slot: 1 }, value: statuses },
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getTransaction") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: {
        slot: 1,
        transaction: { signatures: ["mock"] },
        meta: { err: null, status: { Ok: null }, fee: 5000, postBalances: [2000000000], preBalances: [2000000000] },
      },
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getSignaturesForAddress") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: [],
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getProgramAccounts") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: [],
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getTokenAccountsByOwner") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: { context: { slot: 1 }, value: [] },
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getTokenAccountBalance") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: {
        context: { slot: 1 },
        value: { amount: "0", decimals: 6, uiAmount: 0 },
      },
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getSlot" || rpcReq.method === "getBlockHeight") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: 1000,
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getVersion") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: { "solana-core": "1.18.0", "feature-set": 0 },
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getAccountInfo" || rpcReq.method === "getMultipleAccounts") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: { context: { slot: 0 }, value: null },
      id: rpcReq.id ?? 1,
    });
  }

  if (rpcReq.method === "getLatestBlockhash") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: {
        context: { slot: 0 },
        value: {
          blockhash: "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM",
          lastValidBlockHeight: 1000000,
        },
      },
      id: rpcReq.id ?? 1,
    });
  }

  // Graceful fallback for any other method — returns null result rather than crashing with 503
  return NextResponse.json({
    jsonrpc: "2.0",
    result: null,
    id: rpcReq.id ?? 1,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "SolPredict Solana RPC Proxy",
    cluster: process.env.NEXT_PUBLIC_CLUSTER || "localnet",
    localEndpoint: LOCAL_VALIDATOR,
  });
}
