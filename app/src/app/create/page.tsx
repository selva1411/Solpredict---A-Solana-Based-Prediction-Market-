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
  "w-full bg-cream border border-hairline rounded-[4px] px-4 py-3 text-[14px] text-ink placeholder:text-ash-dim " +
  "focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 transition-colors";
const labelCls = "block text-[13px] font-medium text-ink mb-1.5";

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
      router.push(`/discover`);
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
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          <motion.div variants={fadeInUp}>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-1.5 h-5 bg-cyan rounded-[1px]" />
              <LabelLux>Propose a Market</LabelLux>
            </div>
            <h1 className="font-display text-[30px] font-extrabold text-ink mb-2 tracking-tight">
              Bring a question to market
            </h1>
            <p className="text-[13px] text-ash leading-relaxed">
              Submit a prediction market proposal with clear settlement rules.
              Once an admin approves it, it goes live for everyone to trade.
            </p>
            <p className="num font-mono text-[12px] text-grass mt-2">
              {PROPOSAL_BOND_SOL} SOL bond required — refunded if approved,
              slashed if rejected
            </p>
          </motion.div>

          {/* Stepper */}
          <div className="flex items-center gap-1">
            {steps.map((label, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <React.Fragment key={label}>
                  <button
                    onClick={() => i <= step && setStep(i)}
                    disabled={i > step}
                    className={cn(
                      "flex-1 h-10 rounded-[4px] text-[12px] font-medium border-2 transition-colors snap",
                      active && "bg-ink-fill text-white border-ink",
                      done && "bg-grass text-ink-static border-grass",
                      !active &&
                        !done &&
                        "bg-cream text-ash-dim border-hairline"
                    )}
                  >
                    {i + 1}. {label}
                  </button>
                  {i < steps.length - 1 && (
                    <span
                      className="w-3 h-px bg-hairline shrink-0"
                      aria-hidden
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="surface rounded-[8px] p-5 sm:p-7 space-y-6">
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
                          "h-11 rounded-[4px] border-2 px-3 text-[13px] font-medium transition-colors snap",
                          comparison === c.value
                            ? "border-ink bg-ink-fill text-white"
                            : "border-hairline text-ash hover:border-hairline-2 hover:text-ink"
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
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-1.5 h-5 bg-magenta rounded-[1px]" />
                    <LabelLux>Review Your Proposal</LabelLux>
                  </div>
                  <div className="divide-y divide-hairline border-2 border-ink rounded-[8px] overflow-hidden">
                    <Row label="Question" value={question} />
                    <Row
                      label="Category"
                      value={CATEGORIES[category]?.label ?? "Other"}
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
                <div className="bg-yellow border-2 border-ink rounded-[8px] p-4">
                  <p className="num font-mono text-[13px] text-ink">
                    <span className="font-sans font-medium">
                      Bond required:
                    </span>{" "}
                    {PROPOSAL_BOND_SOL} SOL will be held in escrow until the
                    proposal is approved or rejected by the admin.
                  </p>
                </div>
                {!publicKey && (
                  <div className="bg-magenta/10 border-2 border-no rounded-[8px] p-4">
                    <p className="text-[13px] text-magenta">
                      Connect your wallet to submit.
                    </p>
                  </div>
                )}
                <ButtonLux
                  onClick={handleSubmit}
                  disabled={submitting || !publicKey}
                  className="w-full"
                >
                  {submitting
                    ? "Submitting…"
                    : `Submit Proposal (${PROPOSAL_BOND_SOL} SOL bond)`}
                </ButtonLux>
              </motion.div>
            )}

            <div className="flex justify-between pt-5 border-t border-hairline">
              <ButtonLux
                variant="ghost"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
              >
                Back
              </ButtonLux>
              {step < steps.length - 1 && (
                <ButtonLux
                  onClick={() => setStep(step + 1)}
                  disabled={!canAdvance(step)}
                >
                  Next
                </ButtonLux>
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
    <div className="flex justify-between items-center gap-4 px-4 py-3 bg-sheet">
      <span className="text-[12px] text-ash shrink-0">{label}</span>
      <span className="num font-mono text-[12.5px] text-ink text-right break-words min-w-0">
        {value}
      </span>
    </div>
  );
}
