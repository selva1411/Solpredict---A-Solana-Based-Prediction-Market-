"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/useRealtime";
import { subscribeAppActivity } from "@/lib/sync-events";
import {
  fetchWatchlistFromDb,
  getWatchlist,
  toggleWatchlist,
} from "@/lib/watchlist";

interface AppState {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  watchlist: string[];
  toggleWatchlistItem: (pubkey: string) => void;
  isWatched: (pubkey: string) => boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Universal Cross-Page & Cross-Tab Activity Invalidator
  useEffect(() => {
    const unsub = subscribeAppActivity(() => {
      void queryClient.invalidateQueries();
    });
    return () => unsub();
  }, [queryClient]);

  // Realtime push receiver from backend WebSocket server
  const rt = useRealtime("global");
  useEffect(() => {
    const unsubActivity = rt.on("activity", () => {
      void queryClient.invalidateQueries();
    });
    const unsubMarkets = rt.on("markets", () => {
      void queryClient.invalidateQueries();
    });
    const unsubLeaderboard = rt.on("leaderboard", () => {
      void queryClient.invalidateQueries();
    });
    return () => {
      unsubActivity?.();
      unsubMarkets?.();
      unsubLeaderboard?.();
    };
  }, [rt.on, queryClient]);

  const walletPubkey = publicKey?.toBase58() ?? null;
  const signer = useMemo(
    () => (publicKey ? { publicKey, signMessage } : undefined),
    [walletPubkey, signMessage]
  );

  // Persist the connected wallet so reads elsewhere stay consistent.
  useEffect(() => {
    if (walletPubkey) {
      localStorage.setItem("solpredict-wallet", walletPubkey);
    }
  }, [walletPubkey]);

  // Initialize from localStorage and react to cross-tab or in-tab changes.
  useEffect(() => {
    setWatchlist(getWatchlist());
    const onStorage = () => setWatchlist(getWatchlist());
    const onWatchlistUpdated = (e: Event) => {
      const custom = e as CustomEvent<string[]>;
      if (Array.isArray(custom.detail)) {
        setWatchlist(custom.detail);
      } else {
        setWatchlist(getWatchlist());
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("watchlist-updated", onWatchlistUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("watchlist-updated", onWatchlistUpdated);
    };
  }, []);

  // Load the wallet's watchlist from the DB whenever the wallet changes.
  useEffect(() => {
    if (!walletPubkey) return;
    let cancelled = false;
    fetchWatchlistFromDb(walletPubkey)
      .then((keys) => {
        if (!cancelled) setWatchlist(keys);
      })
      .catch((err) => {
        if (!cancelled) setWatchlist(getWatchlist());
        console.warn("[AppContext] failed to load watchlist from DB", err);
      });
    return () => {
      cancelled = true;
    };
  }, [walletPubkey]);

  const toggleWatchlistItem = useCallback(
    (pubkey: string) => {
      const wallet =
        walletPubkey ?? localStorage.getItem("solpredict-wallet") ?? undefined;
      const next = toggleWatchlist(pubkey, wallet);
      setWatchlist(next);
    },
    [walletPubkey]
  );

  const isWatched = useCallback(
    (pubkey: string) => {
      return watchlist.includes(pubkey);
    },
    [watchlist]
  );

  return (
    <AppContext.Provider
      value={{
        mobileMenuOpen,
        setMobileMenuOpen,
        watchlist,
        toggleWatchlistItem,
        isWatched,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
