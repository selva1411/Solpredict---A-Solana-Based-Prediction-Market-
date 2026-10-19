"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// Credits (off-chain balance top-ups) are ONLY meaningful on localnet where
// SOL transfers are simulated. On devnet/mainnet the real on-chain balance is
// the source of truth and credits must never be overlaid on top of it.
const IS_LOCALNET = process.env.NEXT_PUBLIC_CLUSTER === "localnet";

export const BALANCE_REFRESH_EVENT = "solpredict:balance-refresh";

/**
 * Dispatch this event anywhere in the app to immediately trigger
 * an on-chain wallet balance refresh (e.g. after a trade, LP deposit, or fee withdrawal).
 *
 * Pass deltaLamports ONLY for off-chain credit top-ups (e.g. airdrop faucet).
 * For real on-chain transactions (fee withdrawals, trades), call with no args so
 * the hook fetches the true on-chain balance without inflating it with credits.
 */
export function triggerWalletBalanceRefresh(deltaLamports?: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(BALANCE_REFRESH_EVENT, {
        detail: { deltaLamports },
      })
    );
  }
}

/**
 * Dispatch this to force a hard on-chain balance refresh, bypassing all
 * cached credits and local state guards. Use after real on-chain transactions
 * like fee withdrawals where the wallet's lamport balance has genuinely changed.
 */
export function forceWalletBalanceRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(BALANCE_REFRESH_EVENT, {
        detail: { forceOnChain: true },
      })
    );
  }
}

// Module-level cache to eliminate layout shifts and redundant RPC requests
const balanceCache = new Map<string, number>();

const STORAGE_KEY_PREFIX = "solpredict:balance:";
const STORAGE_CREDITS_PREFIX = "solpredict:wallet-credits:";

function getStoredBalance(walletKey: string | null): number | null {
  if (!walletKey || typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(STORAGE_KEY_PREFIX + walletKey);
    if (val !== null) {
      const num = Number(val);
      if (!isNaN(num) && num >= 0) return num;
    }
  } catch {
    // ignore
  }
  return null;
}

function setStoredBalance(walletKey: string, lamports: number): void {
  if (!walletKey || typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + walletKey, String(lamports));
  } catch {
    // ignore
  }
}

export function getStoredCredits(walletKey: string | null): number {
  if (!walletKey || typeof window === "undefined") return 0;
  try {
    const val = localStorage.getItem(STORAGE_CREDITS_PREFIX + walletKey);
    if (val !== null) {
      const num = Number(val);
      if (!isNaN(num) && num >= 0) return num;
    }
  } catch {
    // ignore
  }
  return 0;
}

export function addStoredCredits(walletKey: string, lamports: number): number {
  if (!walletKey || typeof window === "undefined" || !lamports || lamports <= 0) {
    return getStoredCredits(walletKey);
  }
  const current = getStoredCredits(walletKey);
  const updated = current + lamports;
  try {
    localStorage.setItem(STORAGE_CREDITS_PREFIX + walletKey, String(updated));
  } catch {
    // ignore
  }
  return updated;
}

export interface WalletBalanceState {
  /** Balance in SOL units (e.g. 1.2500) or null if disconnected/loading without cache */
  balanceSol: number | null;
  /** Balance in raw lamports or null */
  balanceLamports: number | null;
  /** Formatted SOL string to 4 decimal places, or "—" */
  formattedSol: string;
  /** Whether balance is currently being requested */
  loading: boolean;
  /** Manual refetch function */
  refetch: () => Promise<void>;
}

/**
 * Hook to inspect and subscribe to the connected wallet's SOL balance.
 * Automatically updates on on-chain account changes, periodic polling (15s),
 * and custom balance-refresh events.
 */
export function useWalletBalance(): WalletBalanceState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const walletKey = publicKey ? publicKey.toBase58() : null;

  const [balanceLamports, setBalanceLamports] = useState<number | null>(() => {
    if (walletKey) {
      if (balanceCache.has(walletKey)) {
        return balanceCache.get(walletKey)!;
      }
      const stored = getStoredBalance(walletKey);
      if (stored !== null) {
        balanceCache.set(walletKey, stored);
        return stored;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    return Boolean(
      walletKey &&
      !balanceCache.has(walletKey) &&
      getStoredBalance(walletKey) === null
    );
  });

  const isMountedRef = useRef(true);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);

  // When true, the next fetchBalance call will trust the raw on-chain result
  // without layering stored credits on top (used after real on-chain tx).
  const fetchBalance = useCallback(async (forceOnChain = false) => {
    if (!publicKey || !connection) {
      setBalanceLamports(null);
      setLoading(false);
      return;
    }

    // Force-fetches bypass the in-flight deduplication guard so that a
    // post-tx refresh always issues a fresh RPC call, not the stale result
    // of a pre-tx balance query that was already in flight.
    if (!forceOnChain && inFlightPromiseRef.current) {
      await inFlightPromiseRef.current;
      return;
    }

    if (forceOnChain && inFlightPromiseRef.current) {
      inFlightPromiseRef.current = null;
    }

    const pubkeyStr = publicKey.toBase58();
    if (forceOnChain) {
      balanceCache.delete(pubkeyStr);
    }

    const isForced = forceOnChain;
    const promise = (async () => {
      try {
        if (!balanceCache.has(pubkeyStr) && getStoredBalance(pubkeyStr) === null) {
          setLoading(true);
        }

        // In force-mode, bust the server-side RPC proxy cache before fetching.
        // The proxy caches getBalance for 2s; without this bust we'd receive
        // the stale pre-tx value even after a successful payout claim.
        if (isForced) {
          try {
            await fetch("/api/rpc", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "cacheBust",
              }),
            });
          } catch {
            // Non-critical: if this fails, getBalance will still proceed
          }
        }

        const lamports = await connection.getBalance(publicKey, "confirmed");
        if (isMountedRef.current) {
          setBalanceLamports(() => {
            if (isForced || !IS_LOCALNET) {
              // Trust the real on-chain result directly:
              // - Always when force-refreshed after a real on-chain tx
              // - Always on devnet/mainnet (credits don't apply there)
              balanceCache.set(pubkeyStr, lamports);
              setStoredBalance(pubkeyStr, lamports);
              return lamports;
            }

            // --- localnet only below this point ---
            const storedCredits = getStoredCredits(pubkeyStr);

            // Guard: Don't let a stale 2 SOL localnet placeholder overwrite a
            // real established balance that differs from it.
            if (
              lamports === 2_000_000_000 &&
              balanceCache.has(pubkeyStr) &&
              balanceCache.get(pubkeyStr) !== 2_000_000_000
            ) {
              return balanceCache.get(pubkeyStr)!;
            }

            // Resolve effective lamports with localnet credits.
            let resolvedLamports = lamports;
            if (storedCredits > 0) {
              const cached = balanceCache.get(pubkeyStr) ?? null;
              if (cached !== null && lamports < cached) {
                resolvedLamports = Math.max(lamports + storedCredits, cached);
              }
            }

            balanceCache.set(pubkeyStr, resolvedLamports);
            setStoredBalance(pubkeyStr, resolvedLamports);
            return resolvedLamports;
          });
        }
      } catch (err) {
        // Degrade gracefully on RPC rate limit or network glitch
        console.warn("[useWalletBalance] Failed to fetch balance:", err);
      } finally {
        inFlightPromiseRef.current = null;
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    })();

    inFlightPromiseRef.current = promise;
    await promise;
  }, [publicKey, connection]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!publicKey) {
      setBalanceLamports(null);
      setLoading(false);
      return () => {
        isMountedRef.current = false;
      };
    }

    // Set immediate cached balance if available
    const key = publicKey.toBase58();
    if (balanceCache.has(key)) {
      setBalanceLamports(balanceCache.get(key)!);
      setLoading(false);
    } else {
      const stored = getStoredBalance(key);
      if (stored !== null) {
        balanceCache.set(key, stored);
        setBalanceLamports(stored);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    // Initial fetch — force-mode on non-localnet to skip any stale cached credits
    void fetchBalance(!IS_LOCALNET);

    // On non-localnet, clear any stale localStorage credits from previous sessions
    // so they can never inflate the balance again.
    if (!IS_LOCALNET) {
      try {
        const creditsKey = STORAGE_CREDITS_PREFIX + key;
        if (localStorage.getItem(creditsKey) !== null) {
          localStorage.removeItem(creditsKey);
        }
      } catch {
        // ignore
      }
    }

    // Subscribe to WebSocket account changes if supported
    let subId: number | null = null;
    try {
      subId = connection.onAccountChange(
        publicKey,
        (accountInfo) => {
          if (!isMountedRef.current) return;
          const rawLamports = accountInfo.lamports;
          // Only overlay credits on localnet — devnet/mainnet balance is always the raw on-chain value.
          const totalLamports = IS_LOCALNET
            ? rawLamports + getStoredCredits(key)
            : rawLamports;
          balanceCache.set(key, totalLamports);
          setStoredBalance(key, totalLamports);
          setBalanceLamports(totalLamports);
        },
        "confirmed"
      );
    } catch {
      // RPC endpoint might not support WSS subscriptions; polling handles it.
    }

    // Event listener for manual / post-tx refresh requests:
    // - forceOnChain: true  → real on-chain tx (fee withdrawal, trade payout);
    //   trust the RPC result directly, don't add credits.
    // - deltaLamports provided → off-chain credit top-up (airdrop faucet);
    //   optimistically add to displayed balance and sync to server.
    // - neither → plain refresh; fetch on-chain and apply credits if applicable.
    const refreshTimers: NodeJS.Timeout[] = [];
    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent<{ deltaLamports?: number; forceOnChain?: boolean }>;
      const detail = customEvent?.detail ?? {};
      const delta = detail.deltaLamports;
      const forceOnChain = Boolean(detail.forceOnChain);
      const pubkeyStr = publicKey?.toBase58();

      if (forceOnChain) {
        if (pubkeyStr) {
          balanceCache.delete(pubkeyStr);
        }
        // Real on-chain transaction: fetch actual balance, skip credit overlay.
        void fetchBalance(true);
        const delays = [800, 2000, 4000, 7000];
        delays.forEach((delay) => {
          const t = setTimeout(() => {
            if (!isMountedRef.current) return;
            void fetchBalance(true);
          }, delay);
          refreshTimers.push(t);
        });
        return;
      }

      if (typeof delta === "number" && !isNaN(delta) && delta > 0 && pubkeyStr) {
        // Off-chain credit (airdrop faucet): optimistically bump displayed balance.
        addStoredCredits(pubkeyStr, delta);
        // Persist to server in background
        fetch("/api/wallet/credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: pubkeyStr, deltaLamports: delta }),
        }).catch(() => {});

        const currentCached =
          balanceCache.get(pubkeyStr) ?? getStoredBalance(pubkeyStr) ?? 0;
        const newTotal = currentCached + delta;
        balanceCache.set(pubkeyStr, newTotal);
        setStoredBalance(pubkeyStr, newTotal);
        setBalanceLamports(newTotal);
      }

      void fetchBalance();

      const delays = [1500, 3500];
      delays.forEach((delay) => {
        const t = setTimeout(() => {
          if (!isMountedRef.current) return;
          void fetchBalance();
        }, delay);
        refreshTimers.push(t);
      });
    };
    window.addEventListener(BALANCE_REFRESH_EVENT, handleRefresh as EventListener);

    // Periodic polling every 15 seconds
    const interval = setInterval(() => {
      void fetchBalance();
    }, 15_000);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener(BALANCE_REFRESH_EVENT, handleRefresh);
      refreshTimers.forEach(clearTimeout);
      clearInterval(interval);
      if (subId !== null) {
        try {
          connection.removeAccountChangeListener(subId);
        } catch {
          // ignore
        }
      }
    };
  }, [publicKey, connection, fetchBalance]);

  const balanceSol =
    balanceLamports !== null ? balanceLamports / LAMPORTS_PER_SOL : null;

  const formattedSol =
    balanceSol !== null
      ? balanceSol.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        })
      : "—";

  return {
    balanceSol,
    balanceLamports,
    formattedSol,
    loading,
    refetch: () => fetchBalance(true),
  };
}
