"use client";

import React, { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { toast } from "sonner";
import { Droplets } from "lucide-react";

const AIRDROP_AMOUNT = 1_000_000_000; // 1 SOL (Devnet faucet standard)

/**
 * AirdropSolButton: Airdrops test SOL on Devnet and Localnet.
 * Accessible from the navigation header.
 */
export function AirdropSolButton() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const [busy, setBusy] = useState(false);

  // Hidden only on mainnet
  if (process.env.NEXT_PUBLIC_CLUSTER === "mainnet-beta") return null;

  const onAirdrop = async () => {
    if (!publicKey) {
      toast.info("Connect your wallet first to receive test SOL", {
        action: {
          label: "Connect",
          onClick: () => setVisible(true),
        },
      });
      return;
    }

    setBusy(true);
    const isLocal = process.env.NEXT_PUBLIC_CLUSTER === "localnet";

    try {
      if (isLocal) {
        // Localnet validator path
        const res = await fetch("/api/rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "requestAirdrop",
            params: [publicKey.toBase58(), AIRDROP_AMOUNT * 2],
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || data?.error) {
          throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
        }
        toast.success("Airdropped 2 SOL to your wallet!");
      } else {
        // Devnet faucet path
        toast.loading("Requesting 1 SOL from Devnet faucet...", { id: "airdrop" });
        const sig = await connection.requestAirdrop(publicKey, AIRDROP_AMOUNT);
        await connection.confirmTransaction(sig, "confirmed");
        toast.success("Successfully received 1 Devnet SOL!", { id: "airdrop" });
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (isLocal) {
        toast.error(`Localnet airdrop failed: ${errMsg.slice(0, 100)}`, { id: "airdrop" });
      } else if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("airdrop limit")) {
        toast.error("Solana Devnet faucet rate limit reached.", {
          id: "airdrop",
          description: "Use faucet.solana.com or solfaucet.com for instant Devnet SOL.",
          action: {
            label: "Open Faucet",
            onClick: () => window.open(`https://faucet.solana.com/?address=${publicKey.toBase58()}`, "_blank"),
          },
          duration: 10000,
        });
      } else {
        toast.error(errMsg.slice(0, 100) || "Airdrop request failed", { id: "airdrop" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onAirdrop}
      disabled={busy}
      className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-[3px] font-sans text-[11px] font-semibold border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] hover:border-[#1F3A52] dark:hover:border-[#7A9BB5] transition-colors disabled:opacity-50 cursor-pointer"
      title="Request test SOL for trading on Devnet"
    >
      <Droplets className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
      <span>{busy ? "Requesting…" : "Faucet"}</span>
    </button>
  );
}

