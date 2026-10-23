"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { toast } from "sonner";
import { Droplets, ExternalLink, Copy, Check, X, RotateCw } from "lucide-react";
import {
  triggerWalletBalanceRefresh,
  forceWalletBalanceRefresh,
  useWalletBalance,
} from "@/hooks/useWalletBalance";

/**
 * AirdropSolButton: Airdrops test SOL on Devnet and Localnet.
 * Accessible from the navigation header.
 */
export function AirdropSolButton() {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { formattedSol, refetch } = useWalletBalance();
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshingModal, setRefreshingModal] = useState(false);

  // Hidden only on mainnet
  if (process.env.NEXT_PUBLIC_CLUSTER === "mainnet-beta") return null;

  const onCopyAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    toast.success("Wallet address copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    forceWalletBalanceRefresh();
  };

  const handleRefreshBalanceInModal = async () => {
    if (refreshingModal) return;
    setRefreshingModal(true);
    try {
      forceWalletBalanceRefresh();
      await refetch();
      toast.success("Wallet balance refreshed!");
    } finally {
      setTimeout(() => setRefreshingModal(false), 500);
    }
  };

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
    toast.loading("Requesting test SOL...", { id: "airdrop" });

    try {
      const res = await fetch("/api/airdrop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        const amountSol = typeof data.amount === "number" ? data.amount : 0.05;
        const amountLamports =
          typeof data.amountLamports === "number"
            ? data.amountLamports
            : Math.round(amountSol * 1e9);

        toast.success(`Successfully received ${amountSol} Devnet SOL!`, {
          id: "airdrop",
          description: data.signature ? `Tx: ${data.signature.slice(0, 16)}...` : undefined,
        });

        // 1. Immediately update displayed header balance with the exact received amount
        triggerWalletBalanceRefresh(amountLamports);
        // 2. Clear RPC cache and trigger multi-stage confirmation polling
        forceWalletBalanceRefresh();
      } else if (data?.rateLimited) {
        toast.dismiss("airdrop");
        setShowModal(true);
      } else {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("airdrop limit")) {
        toast.dismiss("airdrop");
        setShowModal(true);
      } else {
        toast.error(errMsg.slice(0, 100) || "Airdrop request failed", { id: "airdrop" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={onAirdrop}
        disabled={busy}
        className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-[3px] font-sans text-[11px] font-semibold border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] hover:border-[#1F3A52] dark:hover:border-[#7A9BB5] transition-colors disabled:opacity-50 cursor-pointer"
        title="Request test SOL for trading on Devnet"
      >
        <Droplets className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
        <span>{busy ? "Requesting…" : "Faucet"}</span>
      </button>

      {showModal && publicKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#FFFFFF] dark:bg-[#16181B] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-lg max-w-md w-full p-5 shadow-2xl relative">
            <button
              onClick={handleCloseModal}
              className="absolute top-3.5 right-3.5 text-[#888] hover:text-[#222] dark:hover:text-[#fff] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Droplets className="w-5 h-5 text-[#3b82f6]" />
              <h3 className="font-bold text-base text-[#181A1C] dark:text-[#EAE8E3]">
                Solana Devnet Faucets
              </h3>
            </div>

            <p className="text-xs text-[#555D65] dark:text-[#9AA1AA] mb-3 leading-relaxed">
              The public Devnet RPC is currently rate-limited. You can claim free Devnet SOL instantly using any of the official faucets below:
            </p>

            {/* Current Balance Display in Modal */}
            <div className="flex items-center justify-between text-xs font-mono bg-[#F6F5F2] dark:bg-[#202327] rounded p-2.5 border border-[#E2DFD7] dark:border-[#2F343B] mb-3">
              <span className="text-[#555D65] dark:text-[#9AA1AA]">Current Header Balance:</span>
              <span className="font-bold text-[#181A1C] dark:text-[#EAE8E3]">{formattedSol} SOL</span>
            </div>

            {/* Wallet copy box */}
            <div className="bg-[#F6F5F2] dark:bg-[#202327] rounded p-2.5 flex items-center justify-between border border-[#E2DFD7] dark:border-[#2F343B] mb-4">
              <div className="truncate mr-2 font-mono text-[11px] text-[#333] dark:text-[#ccc]">
                {publicKey.toBase58()}
              </div>
              <button
                onClick={onCopyAddress}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#1F3A52] dark:text-[#7A9BB5] hover:underline shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* Faucet links */}
            <div className="space-y-2">
              <a
                href={`https://faucet.solana.com/?address=${publicKey.toBase58()}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 rounded border border-[#E2DFD7] dark:border-[#2A2F36] hover:border-[#3b82f6] hover:bg-[#F0F7FF] dark:hover:bg-[#1E293B] transition-all text-xs font-medium text-[#181A1C] dark:text-[#EAE8E3]"
              >
                <span>1. Official Solana Faucet (Pre-filled)</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#888]" />
              </a>

              <a
                href="https://faucet.quicknode.com/solana/devnet"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 rounded border border-[#E2DFD7] dark:border-[#2A2F36] hover:border-[#3b82f6] hover:bg-[#F0F7FF] dark:hover:bg-[#1E293B] transition-all text-xs font-medium text-[#181A1C] dark:text-[#EAE8E3]"
              >
                <span>2. QuickNode Faucet (Fast & Reliable)</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#888]" />
              </a>

              <a
                href="https://solfaucet.com/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 rounded border border-[#E2DFD7] dark:border-[#2A2F36] hover:border-[#3b82f6] hover:bg-[#F0F7FF] dark:hover:bg-[#1E293B] transition-all text-xs font-medium text-[#181A1C] dark:text-[#EAE8E3]"
              >
                <span>3. SolFaucet.com</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#888]" />
              </a>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E2DFD7] dark:border-[#2A2F36] flex items-center justify-between">
              <button
                type="button"
                onClick={handleRefreshBalanceInModal}
                disabled={refreshingModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[#E2DFD7] dark:border-[#2A2F36] hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold text-[#181A1C] dark:text-[#EAE8E3] cursor-pointer transition-colors"
                title="Refresh current balance"
              >
                <RotateCw className={`w-3.5 h-3.5 ${refreshingModal ? "animate-spin" : ""}`} />
                <span>{refreshingModal ? "Checking..." : "Refresh Balance"}</span>
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-1.5 rounded bg-[#181A1C] dark:bg-[#EAE8E3] text-white dark:text-black font-semibold text-xs cursor-pointer hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

