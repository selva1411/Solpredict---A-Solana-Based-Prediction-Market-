"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as anchor from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { useProgram } from "@/hooks/useProgram";
import { getConfigPda, getProposalPda, getProposalVaultPda } from "@/lib/pda";
import { buildSignSendConfirm } from "@/lib/anchor-utils";
import { signUserProof, userFetch } from "@/lib/user-client";
import { fadeInUp, staggerContainer } from "@/lib/motion-variants";
import { lamportsToSol, solToLamports } from "@/lib/format";
import {
  normalizeOracleFeedId,
  isOracleCategory,
  PYTH_FEED_REGISTRY,
} from "@/lib/pyth-feeds";
import { ButtonLux } from "@/components/ui/button-lux";
import { LabelLux } from "@/components/ui/label-lux";
import { cn } from "@/lib/utils";
import type { PythFeedEntry } from "@/lib/pyth-feeds";

const ORACLE_FEED_CATEGORY: Record<PythFeedEntry["category"], number> = {
  Crypto: 0,
  Tech: 3,
  Other: 4,
};

const PROPOSAL_BOND_SOL = 0.1;
const CATEGORIES = [
  { value: 0, label: "Crypto" },
  { value: 1, label: "Sports" },
  { value: 2, label: "Politics" },
  { value: 3, label: "Tech" },
  { value: 4, label: "Other" },
];
const COMPARISONS = [
  { value: 0, label: "Greater Than (>)" },
  { value: 1, label: "Less Than (<)" },
];
const DEFAULT_FEED_ID =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

const inputCls =
  "w-full bg-[#FFFFFF] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] px-3.5 py-2.5 text-[13px] text-[#181A1C] dark:text-[#EAE8E3] placeholder:text-[#7F8892] dark:placeholder:text-[#68707B] " +
  "focus:outline-none focus:border-[#1F3A52] dark:focus:border-[#7A9BB5] transition-colors";
const labelCls = "block text-[11px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] mb-1.5 font-semibold";

export default function CreateProposalPage() {
  const router = useRouter();
  const { program, connection } = useProgram();
  const { publicKey, signMessage } = useWallet();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(0);
  const [oracleFeedId, setOracleFeedId] = useState(DEFAULT_FEED_ID);
  const [targetPrice, setTargetPrice] = useState("");
  const [targetExpo, setTargetExpo] = useState("-8");
  const [comparison, setComparison] = useState(0);
  const [selectedFeed, setSelectedFeed] = useState("SOL/USD");
  const [customFeed, setCustomFeed] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [resolveDate, setResolveDate] = useState("");
  const [resolveTime, setResolveTime] = useState("");
  const [sharePriceLamports, setSharePriceLamports] = useState("0.001");
  const [outcome1, setOutcome1] = useState("YES");
  const [outcome2, setOutcome2] = useState("NO");
  const [mode, setMode] = useState<"suggest" | "onchain">("suggest");

  const handleSuggestSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question || question.trim().length < 8) {
      toast.error("Please enter a question with at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/proposals/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(publicKey ? { "x-wallet": publicKey.toBase58() } : {}),
        },
        body: JSON.stringify({
          question,
          description,
          category: CATEGORIES[category]?.label || "Crypto",
          outcome1: outcome1.trim() || "YES",
          outcome2: outcome2.trim() || "NO",
          endDate: endDate ? `${endDate}T${endTime || "23:59"}:00` : undefined,
          proposer: publicKey?.toBase58(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit proposal");
      }
      toast.success(
        "Market suggestion submitted! It is now pending Admin approval."
      );
      router.push("/portfolio");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit proposal");
    } finally {
      setSubmitting(false);
    }
  };

  const feedIdBytes = (hex: string): number[] => {
    const cleaned = hex.replace(/^0x/i, "");
    const bytes: number[] = [];
    for (let i = 0; i < 32 && i * 2 + 1 < cleaned.length; i++) {
      bytes.push(parseInt(cleaned.substring(i * 2, i * 2 + 2), 16));
    }
    while (bytes.length < 32) bytes.push(0);
    return bytes;
  };

  const oracleCategory = isOracleCategory(category);
  const steps = oracleCategory
    ? ["Details", "Timing", "Oracle", "Review"]
    : ["Details", "Timing", "Review"];
  const availableFeeds = Object.values(PYTH_FEED_REGISTRY).filter(
    (f) => ORACLE_FEED_CATEGORY[f.category] === category
  );

  const handleCategoryChange = (v: number) => {
    setCategory(v);
    if (!isOracleCategory(v)) return;
    const feeds = Object.values(PYTH_FEED_REGISTRY).filter(
      (f) => ORACLE_FEED_CATEGORY[f.category] === v
    );
    const first = feeds[0] ?? {
      symbol: "SOL/USD",
      feedIdHex: DEFAULT_FEED_ID,
      expo: -8,
    };
    setSelectedFeed(first.symbol);
    setOracleFeedId(first.feedIdHex.replace(/^0x/i, ""));
    setTargetExpo(String(first.expo));
  };

  const handleFeedChange = (symbol: string) => {
    setSelectedFeed(symbol);
    const entry = PYTH_FEED_REGISTRY[symbol];
    if (!entry) return;
    setOracleFeedId(entry.feedIdHex.replace(/^0x/i, ""));
    setTargetExpo(String(entry.expo));
  };

  const handleSubmit = useCallback(async () => {
    if (!program || !publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    setSubmitting(true);
    try {
      const configPda = getConfigPda(program.programId);
      const config = await program.account.config.fetch(configPda);
      const proposalId = config.marketCount as anchor.BN;
      const proposalPda = getProposalPda(proposalId, program.programId);
      const vaultPda = getProposalVaultPda(proposalId, program.programId);
      const endTimestamp = Math.floor(
        new Date(`${endDate}T${endTime}:00`).getTime() / 1000
      );
      const resolveTimestamp = Math.floor(
        new Date(`${resolveDate}T${resolveTime}:00`).getTime() / 1000
      );
      const sharePrice = solToLamports(parseFloat(sharePriceLamports));
      if (endTimestamp <= Math.floor(Date.now() / 1000) + 3600) {
        toast.error("End time must be at least 1 hour in the future");
        setSubmitting(false);
        return;
      }
      if (resolveTimestamp < endTimestamp) {
        toast.error("Resolution time must be after end time");
        setSubmitting(false);
        return;
      }
      const finalFeedHex = oracleCategory ? oracleFeedId : "0".repeat(64);
      const feedIdArr = feedIdBytes(finalFeedHex);
      const expo = Number(targetExpo);
      if (!Number.isInteger(expo)) {
        toast.error("Invalid exponent (must be an integer)");
        setSubmitting(false);
        return;
      }
      const tx = await buildSignSendConfirm(
        program,
        program.methods
          .proposeMarket(
            question,
            description,
            category,
            feedIdArr,
            new anchor.BN(targetPrice),
            expo,
            comparison,
            new anchor.BN(endTimestamp),
            new anchor.BN(resolveTimestamp),
            new anchor.BN(sharePrice)
          )
          .accounts({
            proposer: publicKey,
            config: configPda,
            proposal: proposalPda,
            proposalVault: vaultPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as Record<string, unknown>)
      );
      toast.success("Market proposed on-chain!");
      try {
        await connection.confirmTransaction(tx, "confirmed");
        const proof = await signUserProof(
          { publicKey, signMessage },
          signMessage
        );
        if (!proof) throw new Error("Wallet does not support message signing");
        const res = await userFetch("/api/markets/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            description,
            category: CATEGORIES[category]?.label ?? "Other",
            closeTs: endTimestamp,
            oracleFeedId: normalizeOracleFeedId(finalFeedHex) ?? "0".repeat(64),
            signature: tx,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn(
            "Proposal recorded on-chain but DB record failed:",
            data
          );
          toast.info(
            "Proposal is on-chain. The DB record will be retried — please contact an admin if it does not appear."
          );
        } else {
          toast.success("Market proposed successfully!");
        }
      } catch (err) {
        console.warn("Proposal DB sync failed (on-chain tx succeeded):", err);
        toast.info("Proposal is on-chain, but the DB record failed to sync.");
      }
      router.push(`/portfolio`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    program,
    publicKey,
    question,
    description,
    category,
    oracleCategory,
    targetPrice,
    targetExpo,
    comparison,
    oracleFeedId,
    endDate,
    endTime,
    resolveDate,
    resolveTime,
    sharePriceLamports,
    router,
  ]);

  const canAdvance = (s: number): boolean => {
    switch (s) {
      case 0:
        return question.length >= 10;
      case 1:
        return (
          endDate !== "" &&
          endTime !== "" &&
          resolveDate !== "" &&
          resolveTime !== ""
        );
      case 2:
        return oracleCategory ? targetPrice !== "" : true;
      default:
        return true;
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-8 text-[#181A1C] dark:text-[#EAE8E3]">
      <div className="max-w-2xl mx-auto">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          <motion.div variants={fadeInUp}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1F3A52] dark:bg-[#7A9BB5]" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-semibold">
                Protocol Listing Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181A1C] dark:text-[#EAE8E3] mb-2">
              Bring a Question to Market
            </h1>
            <p className="text-[13px] text-[#555D65] dark:text-[#9AA1AA] leading-relaxed">
              Submit a prediction market proposal with clear settlement rules.
              Once approved by governance or admin, it deploys on-chain for trading.
            </p>
            <p className="font-mono text-[12px] text-[#1D7C59] dark:text-[#52B788] mt-2 font-medium">
              {PROPOSAL_BOND_SOL} SOL bond required — refunded on approval.
            </p>
          </motion.div>

          {/* Stepper */}
          <div className="flex items-center gap-1.5">
            {steps.map((label, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <React.Fragment key={label}>
                  <button
                    onClick={() => i <= step && setStep(i)}
                    disabled={i > step}
                    className={cn(
                      "flex-1 h-9 rounded-[3px] font-mono text-[11px] font-medium border transition-colors cursor-pointer",
                      active && "bg-[#1F3A52] dark:bg-[#7A9BB5] text-white border-[#1F3A52] dark:border-[#7A9BB5]",
                      done && "bg-[#EDF6F1] dark:bg-[#1D7C59]/15 text-[#1D7C59] dark:text-[#52B788] border-[#BCDDCF] dark:border-[#1D7C59]/30",
                      !active &&
                        !done &&
                        "bg-[#F1EFEA] dark:bg-[#21252A] text-[#7F8892] dark:text-[#68707B] border-[#E2DFD7] dark:border-[#2A2F36]"
                    )}
                  >
                    {i + 1}. {label}
                  </button>
                  {i < steps.length - 1 && (
                    <span
                      className="w-2 h-px bg-[#E2DFD7] dark:bg-[#2A2F36] shrink-0"
                      aria-hidden
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="bg-cream border border-hairline rounded-xl p-5 sm:p-7 space-y-6 shadow-sm">
            {step === 0 && (
              <motion.div variants={fadeInUp} className="space-y-5">
                <div>
                  <label className={labelCls}>
                    Question <span className="text-magenta">*</span>
                  </label>
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder='e.g. "Will SOL close above $250 by Dec 31, 2026?"'
                    className={inputCls}
                    maxLength={200}
                  />
                  <div className="flex justify-end mt-1">
                    <span className="num font-mono text-[11px] text-ash-dim">
                      {question.length}/200
                    </span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Settlement rules, sources, and additional context..."
                    className={cn(inputCls, "min-h-[110px] resize-y")}
                    maxLength={400}
                  />
                  <div className="flex justify-end mt-1">
                    <span className="num font-mono text-[11px] text-ash-dim">
                      {description.length}/400
                    </span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Category</label>
                  <select
                    value={category}
                    onChange={(e) =>
                      handleCategoryChange(parseInt(e.target.value))
                    }
                    className={inputCls}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {!oracleCategory && (
                    <p className="text-[12px] text-ash mt-1.5">
                      Sports &amp; Politics markets are resolved by an admin
                      based on your settlement rules — no oracle needed.
                    </p>
                  )}
                </div>
                {/* Custom Outcome Button Labels */}
                <div className="p-4 bg-cream/70 rounded-[6px] border-2 border-hairline space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-bold uppercase tracking-wider text-ink font-display">
                      Custom Outcome Buttons
                    </label>
                    <span className="text-[11px] font-mono text-ash">
                      Customize buttons beyond YES / NO
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>
                        Outcome 1 Button Text <span className="text-grass font-bold">*</span>
                      </label>
                      <input
                        value={outcome1}
                        onChange={(e) => setOutcome1(e.target.value)}
                        placeholder="e.g. YES, Man City, Trump"
                        className={inputCls}
                        maxLength={30}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Outcome 2 Button Text <span className="text-magenta font-bold">*</span>
                      </label>
                      <input
                        value={outcome2}
                        onChange={(e) => setOutcome2(e.target.value)}
                        placeholder="e.g. NO, Arsenal, Harris"
                        className={inputCls}
                        maxLength={30}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    Share Price (SOL) <span className="text-magenta">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={sharePriceLamports}
                    onChange={(e) => setSharePriceLamports(e.target.value)}
                    className={inputCls}
                  />
                  <p className="num font-mono text-[12px] text-ash mt-1.5">
                    Face value of each share. Minimum 0.001 SOL.
                  </p>
                </div>

                {/* Free User Suggestion Button */}
                <div className="pt-2 border-t border-hairline">
                  <button
                    type="button"
                    onClick={handleSuggestSubmit}
                    disabled={submitting || question.length < 8}
                    className="w-full py-3 px-4 rounded-[4px] bg-cyan text-ink font-display font-extrabold uppercase tracking-wider text-xs border-2 border-ink hover:bg-cyan/90 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-button"
                  >
                    {submitting ? "Submitting Suggestion…" : "✨ Submit Free Suggestion for Admin Approval (No SOL Required)"}
                  </button>
                  <p className="text-[11px] text-ash text-center mt-2">
                    Free proposal for regular users — sent directly to the Admin review queue. Or click &ldquo;Next&rdquo; below to advance the on-chain wizard.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div variants={fadeInUp} className="space-y-5">
                <div>
                  <LabelLux className="mb-3">Trading window</LabelLux>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>
                        End Date <span className="text-magenta">*</span>
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        End Time <span className="text-magenta">*</span>
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <LabelLux className="mb-3">Settlement window</LabelLux>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>
                        Resolution Date <span className="text-magenta">*</span>
                      </label>
                      <input
                        type="date"
                        value={resolveDate}
                        onChange={(e) => setResolveDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Resolution Time <span className="text-magenta">*</span>
                      </label>
                      <input
                        type="time"
                        value={resolveTime}
                        onChange={(e) => setResolveTime(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[12px] text-ash-dim">
                  Trading stops at end time. Resolution happens after end time.
                </p>
              </motion.div>
            )}

            {step === 2 && oracleCategory && (
              <motion.div variants={fadeInUp} className="space-y-5">
                <div>
                  <label className={labelCls}>
                    Asset / Oracle Feed <span className="text-magenta">*</span>
                  </label>
                  <select
                    value={selectedFeed}
                    onChange={(e) => handleFeedChange(e.target.value)}
                    className={inputCls}
                  >
                    {availableFeeds.map((f) => (
                      <option key={f.symbol} value={f.symbol}>
                        {f.label} ({f.symbol})
                      </option>
                    ))}
                  </select>
                  <p className="text-[12px] text-ash mt-1.5">
                    The Pyth price feed, feed ID and exponent are filled in
                    automatically for the selected asset.
                  </p>
                  {!customFeed && oracleCategory && (
                    <p className="num font-mono text-[12px] text-grass mt-1.5">
                      Selected feed: 0x{oracleFeedId.slice(0, 12)}…
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2.5 text-[13px] text-ash cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={customFeed}
                    onChange={(e) => setCustomFeed(e.target.checked)}
                    className="w-4 h-4 accent-ink rounded-[4px]"
                  />
                  Use a custom feed ID not listed above
                </label>
                {customFeed && (
                  <div>
                    <label className={labelCls}>Pyth Oracle Feed ID</label>
                    <input
                      value={oracleFeedId}
                      onChange={(e) => setOracleFeedId(e.target.value)}
                      placeholder="64-char hex feed ID"
                      className={cn(inputCls, "font-mono text-[12px]")}
                    />
                    <p className="text-[12px] text-ash mt-1.5">
                      Raw Pyth price feed ID for assets outside the registry.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      Target Price <span className="text-magenta">*</span>
                    </label>
                    <input
                      type="number"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="e.g. 25000000000"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Exponent</label>
                    <input
                      type="number"
                      value={targetExpo}
                      onChange={(e) => setTargetExpo(e.target.value)}
                      className={inputCls}
                    />
                    <p className="text-[12px] text-ash mt-1.5">
                      Pyth exponent (filled in automatically per asset)
                    </p>
                  </div>
                </div>
                <p className="num font-mono text-[12px] text-ash-dim">
                  Target Price is the comparator in feed units: price ×
                  10^exponent. E.g. SOL at $250 → 25000000000.
                </p>
                <div>
                  <label className={labelCls}>
                    Comparison <span className="text-magenta">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {COMPARISONS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setComparison(c.value)}
                        className={cn(
                          "h-9 rounded-[3px] border font-mono text-[12px] transition-colors cursor-pointer",
                          comparison === c.value
                            ? "border-[#1F3A52] dark:border-[#7A9BB5] bg-[#1F3A52] dark:bg-[#7A9BB5] text-white font-medium"
                            : "border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === steps.length - 1 && (
              <motion.div variants={fadeInUp} className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-3.5 bg-[#1F3A52] dark:bg-[#7A9BB5] rounded-xs" />
                    <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-[#181A1C] dark:text-[#EAE8E3]">
                      Review Market Parameters
                    </span>
                  </div>
                  <div className="divide-y divide-[#E2DFD7] dark:divide-[#2A2F36] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] overflow-hidden bg-[#FFFFFF] dark:bg-[#1A1D21]">
                    <Row label="Question" value={question} />
                    <Row
                      label="Category"
                      value={CATEGORIES[category]?.label ?? "Other"}
                    />
                    <Row
                      label="Buttons"
                      value={`${outcome1} vs ${outcome2}`}
                    />
                    <Row
                      label="Share Price"
                      value={`${sharePriceLamports} SOL`}
                    />
                    <Row label="End Time" value={`${endDate} ${endTime}`} />
                    <Row
                      label="Resolution"
                      value={`${resolveDate} ${resolveTime}`}
                    />
                    {oracleCategory ? (
                      <>
                        <Row
                          label="Oracle Feed"
                          value={`${selectedFeed} (0x${oracleFeedId.slice(
                            0,
                            12
                          )}…)`}
                        />
                        <Row label="Target Price" value={targetPrice} />
                        <Row
                          label="Comparison"
                          value={COMPARISONS[comparison]?.label ?? ">"}
                        />
                      </>
                    ) : (
                      <Row
                        label="Oracle Feed"
                        value="N/A — resolved by admin"
                      />
                    )}
                  </div>
                </div>
                <div className="bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] p-4">
                  <p className="font-mono text-[12px] text-[#181A1C] dark:text-[#EAE8E3]">
                    <span className="text-[#1F3A52] dark:text-[#7A9BB5] font-bold">
                      Bond required:
                    </span>{" "}
                    {PROPOSAL_BOND_SOL} SOL will be deposited into the protocol vault. It is refunded immediately upon approval.
                  </p>
                </div>
                {!publicKey && (
                  <div className="bg-[#FBF1F0] dark:bg-[#B43C34]/10 border border-[#F1CEC9] dark:border-[#B43C34]/30 rounded-[3px] p-4">
                    <p className="text-[13px] text-[#B43C34] dark:text-[#E57373]">
                      Connect your wallet to submit this market proposal.
                    </p>
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !publicKey}
                  className="w-full h-10 rounded-[3px] bg-[#1F3A52] hover:bg-[#162B3D] dark:bg-[#6D97B0] dark:hover:bg-[#7FA7BF] text-white font-medium text-[13px] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {submitting
                    ? "Submitting to Solana..."
                    : `Submit Proposal (${PROPOSAL_BOND_SOL} SOL bond)`}
                </button>
              </motion.div>
            )}

            <div className="flex justify-between pt-5 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
              <button
                type="button"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="px-4 py-2 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] text-[12px] font-mono disabled:opacity-40 transition-colors cursor-pointer"
              >
                Back
              </button>
              {step < steps.length - 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={!canAdvance(step)}
                  className="px-5 py-2 rounded-[3px] bg-[#1F3A52] hover:bg-[#162B3D] dark:bg-[#6D97B0] dark:hover:bg-[#7FA7BF] text-white text-[12px] font-mono font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Next Step
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-4 px-4 py-3 bg-[#FFFFFF] dark:bg-[#1A1D21]">
      <span className="font-mono text-[11px] uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] shrink-0 font-medium">{label}</span>
      <span className="font-mono text-[12px] text-[#181A1C] dark:text-[#EAE8E3] text-right break-words min-w-0 font-medium">
        {value}
      </span>
    </div>
  );
}
