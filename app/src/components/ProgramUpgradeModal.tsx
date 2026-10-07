"use client";

import React, { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, X, ShieldAlert, ArrowRight } from "lucide-react";

interface ProgramUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ProgramUpgradeModal({
  isOpen,
  onClose,
  onSuccess,
}: ProgramUpgradeModalProps) {
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [step, setStep] = useState<"idle" | "funding" | "deploying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedAuth, setCopiedAuth] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<{
    authority: string;
    authorityBalance: number;
    requiredSol: number;
    neededSol: number;
    isReady: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("idle");
      setErrorMsg("");
      fetchStatus();
    }
  }, [isOpen]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/admin/upgrade-program");
      const data = await res.json();
      if (res.ok) {
        setUpgradeInfo(data);
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // Re-fetch fresh upgrade status
      let currentNeeded = 0.2;
      let targetAuth = "C3qdS5cuqU3C5MXipxYzA9ymKrcZxuS4RRMKhzVoozer";
      try {
        const checkRes = await fetch("/api/admin/upgrade-program");
        if (checkRes.ok) {
          const freshData = await checkRes.json();
          setUpgradeInfo(freshData);
          currentNeeded = freshData.neededSol ?? 0;
          if (freshData.authority) targetAuth = freshData.authority;
        }
      } catch {
        currentNeeded = upgradeInfo?.neededSol ?? 0.2;
      }

      if (currentNeeded > 0) {
        // Step 1: Fund temporary buffer rent
        setStep("funding");
        setStatusText(`1/2 Sending temporary buffer rent (${currentNeeded.toFixed(2)} SOL) to deployer authority...`);

        const latest = await connection.getLatestBlockhash("confirmed");
        const tx = new Transaction({
          feePayer: publicKey,
          recentBlockhash: latest.blockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(targetAuth),
            lamports: Math.ceil(currentNeeded * 1e9),
          })
        );

        let sig: string;
        if (signTransaction) {
          const signed = await signTransaction(tx);
          sig = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          });
        } else {
          sig = await sendTransaction(tx, connection);
        }

        await connection.confirmTransaction(
          {
            signature: sig,
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight,
          },
          "confirmed"
        );
      }

      // Step 2: Deploy program on devnet
      setStep("deploying");
      setStatusText("2/2 Deploying upgraded program binary to Solana Devnet & issuing refund...");

      const res = await fetch("/api/admin/upgrade-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundWallet: publicKey.toBase58(),
          refundAmount: 0, // 0 tells the server to refund all excess authority funds above baseline back to user
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Deployment failed. Check server logs.");
      }

      setStep("success");
      setStatusText(
        data?.refunded
          ? `Program upgraded successfully! ${data.refundedSol ?? ""} SOL was refunded back to your wallet.`
          : "Program upgraded successfully on Devnet!"
      );

      toast.success("Program contract upgraded on Devnet!");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("[Upgrade Error]", err);
      setStep("error");
      setErrorMsg(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#FFFFFF] dark:bg-[#16181B] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-[#181A1C] dark:text-[#EAE8E3]">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-[#888] hover:text-[#222] dark:hover:text-[#fff] transition-colors disabled:opacity-30 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 bg-amber-500/10 dark:bg-amber-400/10 rounded-lg text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight">Contract Upgrade Required</h3>
            <p className="text-[11px] text-[#71767B]">DeclaredProgramIdMismatch (Error 4100)</p>
          </div>
        </div>

        <p className="text-xs text-[#555D65] dark:text-[#9AA1AA] mb-4 leading-relaxed">
          The program account <code className="bg-[#F0EEE6] dark:bg-[#202327] px-1 py-0.5 rounded text-[11px] font-mono">6HWVuwJu...</code> was compiled with an older program ID. It must be upgraded on Solana Devnet so your transactions succeed.
        </p>

        {/* Upgrade Details Card */}
        <div className="bg-[#F9F8F5] dark:bg-[#1C1F24] border border-[#E2DFD7] dark:border-[#282C34] rounded-lg p-3.5 mb-4 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[#71767B]">Deployer Authority:</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span>
                {upgradeInfo?.authority.slice(0, 6)}...{upgradeInfo?.authority.slice(-4)}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (upgradeInfo?.authority) {
                    navigator.clipboard.writeText(upgradeInfo.authority);
                    setCopiedAuth(true);
                    toast.success("Authority address copied!");
                    setTimeout(() => setCopiedAuth(false), 2000);
                  }
                }}
                className="text-[11px] text-[#1F3A52] dark:text-[#7A9BB5] hover:underline cursor-pointer flex items-center gap-0.5 ml-1"
                title="Copy full authority address"
              >
                {copiedAuth ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#71767B]">Current Authority Balance:</span>
            <span className="font-semibold">{upgradeInfo?.authorityBalance?.toFixed(3) ?? "..."} SOL</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#71767B]">Temporary Buffer Rent Needed:</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {upgradeInfo?.neededSol ? `${upgradeInfo.neededSol.toFixed(3)} SOL` : "0.000 SOL"}
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-[#E2DFD7] dark:border-[#282C34] text-[11px] text-green-700 dark:text-green-400 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>100% of the temporary SOL deposit is automatically refunded upon deployment!</span>
          </div>
        </div>

        {/* Progress & Error Display */}
        {loading && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
            <p className="text-xs font-medium text-blue-900 dark:text-blue-200">{statusText}</p>
          </div>
        )}

        {step === "success" && (
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-xs font-medium text-green-900 dark:text-green-200">{statusText}</p>
          </div>
        )}

        {step === "error" && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 dark:text-red-200 leading-snug break-all">{errorMsg}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
          {step === "success" ? (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Done - Ready to Trade
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={loading}
                className="px-3.5 py-2 rounded-md border border-[#E2DFD7] dark:border-[#2A2F36] hover:bg-[#F2EFE9] dark:hover:bg-[#202327] text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="px-4 py-2 rounded-md bg-[#1F3A52] hover:bg-[#294c6b] text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Upgrading...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {upgradeInfo && upgradeInfo.neededSol > 0
                        ? `Authorize & Upgrade (${upgradeInfo.neededSol.toFixed(2)} SOL)`
                        : "Deploy Contract Upgrade Now"}
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
