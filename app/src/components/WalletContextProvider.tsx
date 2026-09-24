"use client";

import React, { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ENV } from "@/lib/env";
import { AppProvider } from "@/contexts/AppContext";

import "@solana/wallet-adapter-react-ui/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

if (typeof window !== "undefined") {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("ws error:") &&
      (args[1] === undefined || args[1] === "undefined" || !args[1])
    ) {
      // Benign @solana/web3.js websocket retry log; suppress from triggering Next.js dev overlay
      return;
    }
    origError.apply(console, args);
  };
}

export const WalletContextProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const endpoint = useMemo(() => ENV.rpcUrl, []);
  const wsEndpoint = useMemo(() => ENV.wsEndpoint, []);

  // Modern Solana wallets (Phantom, Solflare, Backpack) support the Wallet Standard
  // and are auto-detected by WalletProvider without explicit adapter instances.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{
        ...(wsEndpoint ? { wsEndpoint } : {}),
        commitment: "confirmed",
        disableRetryOnRateLimit: true,
      }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <AppProvider>{children}</AppProvider>
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
