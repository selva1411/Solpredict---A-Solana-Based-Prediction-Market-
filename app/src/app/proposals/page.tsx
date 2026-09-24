"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Sparkles,
  Plus,
  ThumbsUp,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  X,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { notifyAppActivity, subscribeAppActivity } from "@/lib/sync-events";
import { PYTH_FEED_REGISTRY } from "@/lib/pyth-feeds";

interface ProposalItem {
  id: string;
  proposalPubkey: string;
  creator: string;
  question: string;
  description: string;
  category: string;
  createdAt: string;
  endTs?: string | null;
  status: "pending" | "approved" | "rejected" | string;
  bondLamports: number;
  outcome1: string;
  outcome2: string;
  upvotes?: number;
}

const CATEGORIES = ["All", "Crypto", "Sports", "Tech", "Politics", "Other"];
const STATUS_TABS = [
  { id: "all", label: "All Proposals" },
  { id: "pending", label: "Pending Review" },
  { id: "approved", label: "Approved / Live" },
];

export default function ProposalsPage() {
  const { publicKey } = useWallet();
  const { role } = useUserRole();
  const isAdmin = role === "admin";

  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);

  // Suggestion Modal State
  const [submitting, setSubmitting] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("Crypto");
  const [newOutcome1, setNewOutcome1] = useState("YES");
  const [newOutcome2, setNewOutcome2] = useState("NO");
  const [newEndDate, setNewEndDate] = useState("");
  const [selectedFeedKey, setSelectedFeedKey] = useState("SOL/USD");
  const [customFeedId, setCustomFeedId] = useState("");
  const [targetPrice, setTargetPrice] = useState("250");
  const [comparison, setComparison] = useState<"GreaterThan" | "LessThan">("GreaterThan");
  const [settleDelayHours, setSettleDelayHours] = useState("24");
  const [sharePriceSol, setSharePriceSol] = useState("0.01");

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/proposals");
      const data = await res.json();
      if (data.ok && Array.isArray(data.proposals)) {
        // Real upvote count or default 0 (never mock deterministic formulas)
        const withVotes = data.proposals.map((p: ProposalItem) => ({
          ...p,
          upvotes: typeof p.upvotes === "number" ? p.upvotes : 0,
        }));
        setProposals(withVotes);
      }
    } catch {
      toast.error("Failed to load community proposals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  // Universal Cross-Page & Cross-Tab Activity Listener
  useEffect(() => {
    const unsub = subscribeAppActivity(() => {
      fetchProposals();
    });
    return () => unsub();
  }, []);

  const handleUpvote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isUpvoted = upvotedIds.has(id);
    const nextSet = new Set(upvotedIds);
    if (isUpvoted) {
      nextSet.delete(id);
      setProposals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, upvotes: (p.upvotes ?? 1) - 1 } : p))
      );
    } else {
      nextSet.add(id);
      setProposals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, upvotes: (p.upvotes ?? 0) + 1 } : p))
      );
      toast.success("Proposal upvoted! High community votes get prioritized by admin.");
    }
    setUpvotedIds(nextSet);
  };

  const handleCreateSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || newQuestion.trim().length < 8) {
      toast.error("Market title must be at least 8 characters");
      return;
    }

    let feedIdHex: string | undefined;
    if (newCategory === "Crypto") {
      if (selectedFeedKey === "custom") {
        const clean = customFeedId.trim().replace(/^0x/i, "");
        if (clean.length !== 64 || !/^[0-9a-fA-F]+$/.test(clean)) {
          toast.error("Custom Pyth feed ID must be a 64-character hex string");
          return;
        }
        feedIdHex = clean;
      } else {
        feedIdHex = PYTH_FEED_REGISTRY[selectedFeedKey]?.feedIdHex.replace(/^0x/i, "");
      }

      const p = parseFloat(targetPrice);
      if (isNaN(p) || p <= 0) {
        toast.error("Please enter a valid positive target price for Crypto markets");
        return;
      }
    }

    const sharePriceNum = parseFloat(sharePriceSol || "0.01");
    if (isNaN(sharePriceNum) || sharePriceNum < 0.0001) {
      toast.error("Minimum share price is 0.0001 SOL");
      return;
    }
    const sharePriceLamports = Math.round(sharePriceNum * 1_000_000_000);

    setSubmitting(true);
    try {
      const res = await fetch("/api/proposals/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(publicKey ? { "x-wallet": publicKey.toBase58() } : {}),
        },
        body: JSON.stringify({
          question: newQuestion.trim(),
          description: newDescription.trim(),
          category: newCategory,
          outcome1: newOutcome1.trim() || "YES",
          outcome2: newOutcome2.trim() || "NO",
          endDate: newEndDate ? new Date(newEndDate).toISOString() : undefined,
          proposer: publicKey?.toBase58(),
          oracleFeedId: feedIdHex,
          targetPrice: newCategory === "Crypto" ? targetPrice : undefined,
          targetExpo: newCategory === "Crypto" ? (selectedFeedKey === "custom" ? -8 : PYTH_FEED_REGISTRY[selectedFeedKey]?.expo ?? -8) : undefined,
          comparison: comparison === "GreaterThan" ? 0 : 1,
          settleDelayHours: parseInt(settleDelayHours, 10) || 24,
          sharePriceLamports,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success("✨ Proposal submitted successfully! It is now pending admin approval.");
        setShowModal(false);
        setNewQuestion("");
        setNewDescription("");
        setNewOutcome1("YES");
        setNewOutcome2("NO");
        setNewEndDate("");
        setTargetPrice("250");
        setCustomFeedId("");
        // Optimistic refresh
        fetchProposals();
        notifyAppActivity({
          wallet: publicKey?.toBase58(),
          type: "proposal_created",
        });
      } else {
        toast.error(data.error || "Failed to submit proposal");
      }
    } catch {
      toast.error("Network error while submitting proposal");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const matchesSearch =
        !search.trim() ||
        p.question.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()) ||
        p.outcome1.toLowerCase().includes(search.toLowerCase()) ||
        p.outcome2.toLowerCase().includes(search.toLowerCase());

      const matchesCat =
        selectedCategory === "All" ||
        p.category?.toLowerCase() === selectedCategory.toLowerCase();

      const matchesStatus =
        selectedStatus === "all"
          ? true
          : selectedStatus === "pending"
          ? p.status === "pending"
          : p.status === "approved";

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [proposals, search, selectedCategory, selectedStatus]);

  const stats = useMemo(() => {
    const total = proposals.length;
    const pending = proposals.filter((p) => p.status === "pending").length;
    const approved = proposals.filter((p) => p.status === "approved").length;
    return { total, pending, approved };
  }, [proposals]);

  return (
    <div className="min-h-screen pb-24 text-[#181A1C] dark:text-[#EAE8E3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        {/* Hero Section */}
        <div className="relative rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] p-6 sm:p-10 mb-8 overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] text-[11px] font-mono font-semibold bg-[#F1EFEA] text-[#1F3A52] border border-[#E2DFD7] dark:bg-[#21252A] dark:text-[#7A9BB5] dark:border-[#2A2F36] mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>COMMUNITY PROPOSALS &amp; LISTINGS</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181A1C] dark:text-[#EAE8E3]">
                Suggest &amp; Shape Upcoming Markets
              </h1>
              <p className="mt-2 text-[14px] text-[#555D65] dark:text-[#9AA1AA] leading-relaxed">
                Freedom for anyone to propose tomorrow&apos;s prediction markets. Define custom outcome
                labels, rally community sentiment, and get your market deployed on-chain by protocol admins.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-[3px] font-sans text-[12px] font-semibold bg-[#1F3A52] text-white hover:bg-[#162B3D] dark:bg-[#6D97B0] dark:text-[#131518] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Suggest New Market</span>
              </button>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-[3px] font-sans text-[12px] font-semibold border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#21252A] text-[#181A1C] dark:text-[#EAE8E3] hover:border-[#1F3A52] transition-all"
                >
                  <ShieldCheck className="w-4 h-4 text-[#1D7C59] dark:text-[#52B788]" />
                  <span>Review Queue ({stats.pending})</span>
                </Link>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
            <div>
              <span className="block text-[11px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-semibold">Total Proposed</span>
              <span className="text-2xl font-bold font-mono text-[#181A1C] dark:text-[#EAE8E3] mt-0.5">{stats.total}</span>
            </div>
            <div>
              <span className="block text-[11px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-semibold">Pending Review</span>
              <span className="text-2xl font-bold font-mono text-[#1F3A52] dark:text-[#7A9BB5] mt-0.5">{stats.pending}</span>
            </div>
            <div>
              <span className="block text-[11px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-semibold">Approved &amp; Live</span>
              <span className="text-2xl font-bold font-mono text-[#1D7C59] dark:text-[#52B788] mt-0.5">{stats.approved}</span>
            </div>
            <div>
              <span className="block text-[11px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-semibold">Bond Required</span>
              <span className="text-2xl font-bold font-mono text-[#181A1C] dark:text-[#EAE8E3] mt-0.5">0.00 SOL <span className="text-xs font-normal text-[#7F8892] dark:text-[#68707B]">(Free)</span></span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center mb-6">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-0.5 rounded-[3px] bg-[#F1EFEA] dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36]">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1.5 rounded-[2px] font-sans text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedStatus === tab.id
                    ? "bg-white dark:bg-[#21252A] text-[#181A1C] dark:text-[#EAE8E3] shadow-xs"
                    : "text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Categories */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7F8892] dark:text-[#68707B]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search proposals..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181A1C] dark:text-[#EAE8E3] placeholder:text-[#7F8892] dark:placeholder:text-[#68707B] focus:outline-none focus:border-[#1F3A52] dark:focus:border-[#7A9BB5] transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-[3px] text-xs font-sans transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[#1F3A52] dark:bg-[#7A9BB5] text-white font-semibold"
                      : "border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Proposals Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="h-64 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] animate-pulse p-6"
              />
            ))}
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="rounded-[3px] border border-dashed border-[#E2DFD7] dark:border-[#2A2F36] p-12 text-center bg-[#FFFFFF] dark:bg-[#1A1D21]">
            <Sparkles className="w-10 h-10 text-[#7F8892] dark:text-[#68707B] mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-semibold text-[#181A1C] dark:text-[#EAE8E3]">No proposals found</h3>
            <p className="text-sm text-[#555D65] dark:text-[#9AA1AA] mt-1 max-w-sm mx-auto">
              Be the first to suggest a market with custom outcome buttons!
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[3px] text-xs font-semibold bg-[#1F3A52] dark:bg-[#6D97B0] text-white hover:bg-[#162B3D] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Suggest First Market</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProposals.map((item) => {
              const isUpvoted = upvotedIds.has(item.id);
              const isPending = item.status === "pending";
              const isApproved = item.status === "approved";

              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] hover:border-[#C8C4B8] dark:hover:border-[#39404A] transition-all p-5"
                >
                  <div>
                    {/* Top Row: Category & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-[2px] text-[10px] font-mono uppercase tracking-wider font-semibold bg-[#F1EFEA] text-[#555D65] dark:bg-[#21252A] dark:text-[#9AA1AA]">
                        {item.category}
                      </span>

                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[2px] text-[11px] font-mono font-medium bg-[#F1EFEA] text-[#1F3A52] border border-[#E2DFD7] dark:bg-[#21252A] dark:text-[#7A9BB5] dark:border-[#2A2F36]">
                          <Clock className="w-3 h-3" />
                          <span>Pending Review</span>
                        </span>
                      ) : isApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[2px] text-[11px] font-mono font-medium bg-[#EDF6F1] text-[#145C42] border border-[#BCDDCF] dark:bg-[#1D7C59]/15 dark:text-[#52B788] dark:border-[#1D7C59]/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approved &amp; Active</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-mono text-[#7F8892] bg-[#F1EFEA] dark:bg-[#21252A]">
                          {item.status}
                        </span>
                      )}
                    </div>

                    {/* Question */}
                    <h3 className="font-semibold text-base text-[#181A1C] dark:text-[#EAE8E3] line-clamp-2 leading-snug group-hover:text-[#1F3A52] dark:group-hover:text-[#7A9BB5] transition-colors">
                      {item.question}
                    </h3>

                    {/* Description Excerpt */}
                    {item.description && (
                      <p className="text-xs text-[#555D65] dark:text-[#9AA1AA] line-clamp-2 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {/* Custom Outcomes Preview */}
                    <div className="mt-4 pt-3 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] mb-1.5 font-bold">
                        Outcome Buttons
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="px-2.5 py-2 rounded-[2px] text-xs font-semibold bg-[#EDF6F1] text-[#145C42] border border-[#BCDDCF] dark:bg-[#1D7C59]/10 dark:text-[#52B788] dark:border-[#1D7C59]/25 flex items-center justify-between">
                          <span className="truncate">{item.outcome1}</span>
                          <span className="text-[10px] opacity-75 font-mono">50¢</span>
                        </div>
                        <div className="px-2.5 py-2 rounded-[2px] text-xs font-semibold bg-[#FBF1F0] text-[#8E2F29] border border-[#ECCDC9] dark:bg-[#B43C34]/10 dark:text-[#E57373] dark:border-[#B43C34]/25 flex items-center justify-between">
                          <span className="truncate">{item.outcome2}</span>
                          <span className="text-[10px] opacity-75 font-mono">50¢</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Proposer, Upvote, Time */}
                  <div className="mt-5 pt-3 border-t border-[#E2DFD7] dark:border-[#2A2F36] flex items-center justify-between text-xs text-[#7F8892] dark:text-[#9AA1AA]">
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span>by</span>
                      <span className="font-medium text-[#181A1C] dark:text-[#EAE8E3] truncate max-w-[100px]" title={item.creator}>
                        {item.creator.slice(0, 4)}...{item.creator.slice(-4)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleUpvote(item.id, e)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] font-mono text-xs font-semibold transition-all cursor-pointer ${
                          isUpvoted
                            ? "bg-[#1F3A52] dark:bg-[#7A9BB5] text-white"
                            : "bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2A2F36] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                        }`}
                        title="Upvote to bump priority for admin review"
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${isUpvoted ? "fill-white" : ""}`} />
                        <span>{item.upvotes}</span>
                      </button>

                      {isAdmin && isPending && (
                        <Link
                          href="/admin"
                          className="px-2.5 py-1.5 rounded-[2px] bg-[#1F3A52]/10 text-[#1F3A52] hover:bg-[#1F3A52]/20 dark:bg-[#7A9BB5]/15 dark:text-[#7A9BB5] text-xs font-semibold transition-colors"
                        >
                          Review
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggestion Creation Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl rounded-[4px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] p-6 sm:p-8 shadow-xl z-10 my-8 overflow-hidden text-[#181A1C] dark:text-[#EAE8E3]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#E2DFD7] dark:border-[#2A2F36]">
                <div>
                  <h2 className="text-lg font-bold text-[#181A1C] dark:text-[#EAE8E3] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#1F3A52] dark:text-[#7A9BB5]" />
                    <span>Suggest an Upcoming Market</span>
                  </h2>
                  <p className="text-xs text-[#555D65] dark:text-[#9AA1AA] mt-0.5">
                    Free community suggestion — zero bond required. Reviewed by admins.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] text-[#7F8892] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSuggestion} className="space-y-4 mt-5">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] mb-1.5 font-bold">
                    Market Question / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder='e.g. Will Solana reach $300 before Q4?'
                    className="w-full px-3.5 py-2.5 text-sm rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181A1C] dark:text-[#EAE8E3] placeholder:text-[#7F8892] dark:placeholder:text-[#68707B] focus:outline-none focus:border-[#1F3A52] dark:focus:border-[#7A9BB5] transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] mb-1.5 font-bold">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52] dark:focus:border-[#7A9BB5] transition-colors"
                    >
                      {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] mb-1.5 font-bold">
                      Target Resolution Date
                    </label>
                    <input
                      type="date"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52] dark:focus:border-[#7A9BB5] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] mb-1.5 font-bold">
                    Resolution Criteria &amp; Description
                  </label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Provide context or rules on how this market resolves..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181A1C] dark:text-[#EAE8E3] placeholder:text-[#7F8892] dark:placeholder:text-[#68707B] focus:outline-none focus:border-[#1F3A52] dark:focus:border-[#7A9BB5] transition-colors resize-none"
                  />
                </div>

                {/* Crypto Oracle & Automated Settlement Parameters */}
                {newCategory === "Crypto" && (
                  <div className="p-4 rounded-[3px] border border-[#1F3A52]/30 dark:border-[#7A9BB5]/30 bg-[#F1EFEA]/80 dark:bg-[#1A1D21]/90 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-[#E2DFD7] dark:border-[#2A2F36] pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#1F3A52] dark:text-[#7A9BB5]">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Pyth Oracle Settlement Configuration</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#1F3A52]/10 dark:bg-[#7A9BB5]/20 text-[#1F3A52] dark:text-[#7A9BB5]">
                        On-Chain Verified
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-[#7F8892] dark:text-[#68707B] font-semibold mb-1">
                          Pyth Price Feed Asset *
                        </label>
                        <select
                          value={selectedFeedKey}
                          onChange={(e) => setSelectedFeedKey(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#141619] text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52]"
                        >
                          {Object.keys(PYTH_FEED_REGISTRY).map((k) => (
                            <option key={k} value={k}>
                              {PYTH_FEED_REGISTRY[k].symbol} ({PYTH_FEED_REGISTRY[k].label})
                            </option>
                          ))}
                          <option value="custom">Custom Feed ID (Hex)...</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono text-[#7F8892] dark:text-[#68707B] font-semibold mb-1">
                          Target Strike Price (USD) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={targetPrice}
                          onChange={(e) => setTargetPrice(e.target.value)}
                          placeholder="e.g. 250.00"
                          className="w-full px-3 py-2 text-xs rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#141619] text-[#181A1C] dark:text-[#EAE8E3] font-mono focus:outline-none focus:border-[#1F3A52]"
                        />
                      </div>
                    </div>

                    {selectedFeedKey === "custom" && (
                      <div>
                        <label className="block text-[11px] font-mono text-[#7F8892] dark:text-[#68707B] font-semibold mb-1">
                          Custom Pyth Feed ID (64 hex characters)
                        </label>
                        <input
                          type="text"
                          value={customFeedId}
                          onChange={(e) => setCustomFeedId(e.target.value)}
                          placeholder="0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
                          className="w-full px-3 py-2 text-xs font-mono rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#141619] text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52]"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-[#7F8892] dark:text-[#68707B] font-semibold mb-1">
                          Outcome 1 Condition
                        </label>
                        <select
                          value={comparison}
                          onChange={(e) => setComparison(e.target.value as "GreaterThan" | "LessThan")}
                          className="w-full px-3 py-2 text-xs rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#141619] text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52]"
                        >
                          <option value="GreaterThan">&ge; Greater Than or Equal To Target</option>
                          <option value="LessThan">&le; Less Than or Equal To Target</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono text-[#7F8892] dark:text-[#68707B] font-semibold mb-1">
                          Settlement Delay (Hours after End)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={settleDelayHours}
                          onChange={(e) => setSettleDelayHours(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#141619] text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52]"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-[2px] bg-[#FFFFFF] dark:bg-[#141619] border border-[#E2DFD7] dark:border-[#2A2F36] text-[11px] font-mono text-[#555D65] dark:text-[#9AA1AA]">
                      <span className="text-[#1F3A52] dark:text-[#7A9BB5] font-bold">Rule Preview: </span>
                      {newOutcome1 || "YES"} wins if {selectedFeedKey === "custom" ? "Custom Asset" : selectedFeedKey} price is {comparison === "GreaterThan" ? ">= " : "<= "}${targetPrice || "0"} at settlement.
                    </div>
                  </div>
                )}

                {/* Share Price Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA]/40 dark:bg-[#21252A]/40">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] mb-1 font-bold">
                      Base Share Price (SOL)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.0001"
                      value={sharePriceSol}
                      onChange={(e) => setSharePriceSol(e.target.value)}
                      placeholder="0.01"
                      className="w-full px-3 py-2 text-xs font-mono rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181A1C] dark:text-[#EAE8E3] focus:outline-none focus:border-[#1F3A52]"
                    />
                  </div>
                  <div className="flex flex-col justify-center text-[11px] font-mono text-[#7F8892] dark:text-[#68707B]">
                    <span>Converted Lamports:</span>
                    <span className="text-xs font-bold text-[#181A1C] dark:text-[#EAE8E3]">
                      {(Math.round((parseFloat(sharePriceSol) || 0.01) * 1_000_000_000)).toLocaleString()} lamports
                    </span>
                  </div>
                </div>

                {/* Customizable Outcome Buttons */}
                <div className="p-4 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA]/60 dark:bg-[#21252A]/60">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] font-bold">
                      Customize Outcome Button Labels
                    </label>
                    <span className="text-[10px] font-mono text-[#7F8892] dark:text-[#68707B]">
                      Custom labels instead of generic YES / NO
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <span className="block text-[11px] text-[#1D7C59] dark:text-[#52B788] font-semibold mb-1">
                        Outcome 1 Label
                      </span>
                      <input
                        type="text"
                        value={newOutcome1}
                        onChange={(e) => setNewOutcome1(e.target.value)}
                        placeholder="e.g. YES or Man City"
                        className="w-full px-3 py-2 text-xs rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181A1C] dark:text-[#EAE8E3] font-semibold focus:outline-none focus:border-[#1F3A52]"
                      />
                    </div>

                    <div>
                      <span className="block text-[11px] text-[#B43C34] dark:text-[#E57373] font-semibold mb-1">
                        Outcome 2 Label
                      </span>
                      <input
                        type="text"
                        value={newOutcome2}
                        onChange={(e) => setNewOutcome2(e.target.value)}
                        placeholder="e.g. NO or Arsenal"
                        className="w-full px-3 py-2 text-xs rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#181A1C] dark:text-[#EAE8E3] font-semibold focus:outline-none focus:border-[#1F3A52]"
                      />
                    </div>
                  </div>

                  {/* Live Button Preview */}
                  <div className="pt-2 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
                    <span className="block text-[10px] font-mono text-[#7F8892] dark:text-[#68707B] mb-1.5">Live Preview of Market Trading Buttons:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="py-2 px-3 text-center rounded-[3px] bg-[#1D7C59] text-white font-bold text-xs">
                        Buy {newOutcome1 || "YES"}
                      </div>
                      <div className="py-2 px-3 text-center rounded-[3px] bg-[#B43C34] text-white font-bold text-xs">
                        Buy {newOutcome2 || "NO"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E2DFD7] dark:border-[#2A2F36] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-[3px] text-xs font-mono border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2 rounded-[3px] text-xs font-mono font-semibold bg-[#1F3A52] text-white hover:bg-[#162B3D] dark:bg-[#6D97B0] dark:text-[#131518] disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submitting ? (
                      <span>Submitting Proposal...</span>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Submit for Admin Approval (Free)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
