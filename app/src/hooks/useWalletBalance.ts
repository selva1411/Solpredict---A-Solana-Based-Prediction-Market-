"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export const BALANCE_REFRESH_EVENT = "solpredict:balance-refresh";

/**
 * Dispatch this event anywhere in the app to immediately trigger
 * an on-chain wallet balance refresh (e.g. after a trade, LP deposit, or airdrop).
 */
export function triggerWalletBalanceRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BALANCE_REFRESH_EVENT));
  }
}

// Module-level cache to eliminate layout shifts and redundant RPC requests
const balanceCache = new Map<string, number>();

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
    if (walletKey && balanceCache.has(walletKey)) {
      return balanceCache.get(walletKey)!;
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    return Boolean(walletKey && !balanceCache.has(walletKey));
  });

  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connection) {
      setBalanceLamports(null);
      setLoading(false);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      if (!balanceCache.has(publicKey.toBase58())) {
        setLoading(true);
      }
      const lamports = await connection.getBalance(publicKey, "confirmed");
      balanceCache.set(publicKey.toBase58(), lamports);
      if (isMountedRef.current) {
        setBalanceLamports(lamports);
      }
    } catch (err) {
      // Degrade gracefully on RPC rate limit or network glitch
      console.warn("[useWalletBalance] Failed to fetch balance:", err);
    } finally {
      fetchingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
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
      setLoading(true);
    }

    // Initial fetch
    void fetchBalance();

    // Subscribe to WebSocket account changes if supported
    let subId: number | null = null;
    try {
      subId = connection.onAccountChange(
        publicKey,
        (accountInfo) => {
          if (!isMountedRef.current) return;
          const lamports = accountInfo.lamports;
          balanceCache.set(key, lamports);
          setBalanceLamports(lamports);
        },
        "confirmed"
      );
    } catch {
      // RPC endpoint might not support WSS subscriptions; polling handles it.
    }

    // Event listener for manual / post-tx refresh requests
    const handleRefresh = () => {
      void fetchBalance();
    };
    window.addEventListener(BALANCE_REFRESH_EVENT, handleRefresh);

    // Periodic polling every 15 seconds
    const interval = setInterval(() => {
      void fetchBalance();
    }, 15_000);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener(BALANCE_REFRESH_EVENT, handleRefresh);
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
    refetch: fetchBalance,
  };
}
