"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import { Check, X, Loader2, Sparkles, Tag } from "lucide-react";
import { toast } from "sonner";
import { adminFetch } from "@/lib/admin-client";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

interface Proposal {
  id: string;
  creator: string;
  proposalPubkey: string;
  question: string;
  description: string;
  category: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
}

interface ProposalsSectionProps {
  onApprove?: (
    proposal: Proposal,
    liquidity?: { yesSol: number; noSol: number }
  ) => Promise<void>;
  onReject?: (proposal: Proposal) => Promise<void>;
}

export function ProposalsSection({
  onApprove,
  onReject,
}: ProposalsSectionProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalProposal, setApprovalProposal] = useState<Proposal | null>(null);

  // Custom Outcome Labels
  const [outcome1Label, setOutcome1Label] = useState("YES");
  const [outcome2Label, setOutcome2Label] = useState("NO");
  const [yesLiquidity, setYesLiquidity] = useState("2.5");
  const [noLiquidity, setNoLiquidity] = useState("2.5");
  const [saving, setSaving] = useState(false);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/proposals");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Unauthorized – admin access required.");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setProposals(Array.isArray(data) ? data : data.proposals ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionLoading(id);
    try {
      const proposal = proposals.find((p) => p.id === id);
      if (action === "approve" && proposal) {
        // Parse suggested outcomes if present in description
        const match = proposal.description?.match(/\[OUTCOMES: "(.*?)" vs "(.*?)"\]/);
        setOutcome1Label(match ? match[1] : "YES");
        setOutcome2Label(match ? match[2] : "NO");
        setYesLiquidity("2.5");
        setNoLiquidity("2.5");
        setApprovalProposal(proposal);
        return;
      }
      if (action === "reject") {
        if (onReject && proposal) {
          await onReject(proposal).catch(() => {});
        }
        const res = await adminFetch(`/api/admin/proposals`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action: "reject" }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("Proposal rejected.");
        setProposals((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error("Proposal action failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Proposal action failed"
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmApproval(yesSol: number, noSol: number) {
    if (!approvalProposal) return;
    setSaving(true);
    try {
      if (onApprove) {
        try {
          await onApprove(approvalProposal, { yesSol, noSol });
        } catch {
          // Fallback to database approval if not on-chain
        }
      }

      const res = await adminFetch(`/api/admin/proposals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: approvalProposal.id,
          action: "approve",
          outcome1: outcome1Label.trim() || "YES",
          outcome2: outcome2Label.trim() || "NO",
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(
        `Market approved with custom buttons: "${outcome1Label}" vs "${outcome2Label}"!`
      );
      setProposals((prev) => prev.filter((p) => p.id !== approvalProposal.id));
      setApprovalProposal(null);
    } catch (err) {
      console.error("Proposal approval failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Approval failed"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSeed() {
    const yesSol = parseFloat(yesLiquidity) || 0;
    const noSol = parseFloat(noLiquidity) || 0;
    await confirmApproval(yesSol, noSol);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-ash" />
      </div>
    );
  }

  if (error) {
    return (
      <motion.section
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-magenta/5 border border-magenta/20 rounded-[8px] p-6 text-center"
      >
        <p className="text-xs font-mono text-magenta">{error}</p>
        <button
          onClick={fetchProposals}
          className="mt-3 text-xs text-ash hover:text-ink underline"
        >
          Try again
        </button>
      </motion.section>
    );
  }

  if (proposals.length === 0) {
    return (
      <motion.section
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-cream border border-hairline rounded-[8px] shadow-sm p-8 text-center"
      >
        <p className="text-[13px] text-ash">No proposals in queue.</p>
      </motion.section>
    );
  }

  return (
    <motion.section
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-5 bg-cyan rounded-[1px]" />
          <h2 className="text-[21px] font-display font-extrabold uppercase tracking-wider text-ink">
            Market Proposals &amp; User Suggestions
          </h2>
        </div>
        <span className="font-mono text-xs text-ash bg-sheet px-2.5 py-1 rounded border border-hairline">
          {proposals.length} pending
        </span>
      </div>

      <div className="divide-y divide-hairline">
        {proposals.map((proposal) => {
          const match = proposal.description?.match(/\[OUTCOMES: "(.*?)" vs "(.*?)"\]/);
          const suggestedO1 = match ? match[1] : "YES";
          const suggestedO2 = match ? match[2] : "NO";
          const cleanDesc = proposal.description?.replace(/\[OUTCOMES: ".*?" vs ".*?"\]/, "").trim();

          return (
            <div
              key={proposal.id}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-cream/40 px-2 rounded transition-colors"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="text-[14px] font-bold text-ink leading-snug">
                  {proposal.question}
                </div>
                {cleanDesc && (
                  <p className="text-[12px] text-ash line-clamp-2">
                    {cleanDesc}
                  </p>
                )}
                <div className="text-[10px] text-ash font-mono flex flex-wrap items-center gap-2 pt-1">
                  <span>
                    by {proposal.creator.slice(0, 6)}...{proposal.creator.slice(-4)}
                  </span>
                  <span className="text-hairline">|</span>
                  <span className="font-bold text-ink">{proposal.category}</span>
                  <span className="text-hairline">|</span>
                  <span className="inline-flex items-center gap-1 bg-sheet px-2 py-0.5 rounded border border-hairline text-ink">
                    <Tag className="w-3 h-3 text-magenta" />
                    Buttons: <strong className="text-grass">{suggestedO1}</strong> vs <strong className="text-magenta">{suggestedO2}</strong>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${
                      proposal.status === "approved"
                        ? "bg-grass/10 text-grass"
                        : proposal.status === "rejected"
                        ? "bg-magenta/10 text-magenta"
                        : "bg-yellow/30 text-ink"
                    }`}
                  >
                    {proposal.status}
                  </span>
                </div>
              </div>

              {proposal.status === "pending" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={actionLoading !== null}
                    onClick={() => handleAction(proposal.id, "approve")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-[4px] bg-grass text-ink hover:bg-grass/90 transition-all cursor-pointer disabled:opacity-50 active:scale-97 border border-grass"
                  >
                    {actionLoading === proposal.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Review &amp; Approve
                  </button>
                  <button
                    disabled={actionLoading !== null}
                    onClick={() => handleAction(proposal.id, "reject")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-[4px] bg-magenta/10 text-magenta border border-magenta/20 hover:bg-magenta/20 transition-all cursor-pointer disabled:opacity-50 active:scale-97"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Approve + Customize Buttons Modal */}
      {approvalProposal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !saving && setApprovalProposal(null)}
          />
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="relative w-full max-w-lg bg-cream border-2 border-ink rounded-[8px] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h3 className="text-[17px] font-display font-extrabold uppercase tracking-wider text-ink flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-magenta" />
                <span>Approve Market &amp; Customize Buttons</span>
              </h3>
              <button
                onClick={() => !saving && setApprovalProposal(null)}
                className="text-ash hover:text-ink p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13px] text-ink font-semibold leading-snug">
              &ldquo;{approvalProposal.question}&rdquo;
            </p>

            {/* Customize Outcome Buttons Section */}
            <div className="p-3.5 bg-sheet rounded-[6px] border border-hairline space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink font-display">
                  Custom Outcome Buttons
                </span>
                <span className="text-[10px] font-mono text-ash">
                  Replaces default YES / NO
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-grass font-mono font-bold">
                    Outcome 1 Button Label
                  </span>
                  <input
                    type="text"
                    value={outcome1Label}
                    onChange={(e) => setOutcome1Label(e.target.value)}
                    disabled={saving}
                    placeholder="e.g. YES or Man City"
                    className="w-full bg-cream border border-hairline rounded-[4px] px-3 py-2 text-xs font-bold text-ink focus:outline-none focus:border-grass"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-magenta font-mono font-bold">
                    Outcome 2 Button Label
                  </span>
                  <input
                    type="text"
                    value={outcome2Label}
                    onChange={(e) => setOutcome2Label(e.target.value)}
                    disabled={saving}
                    placeholder="e.g. NO or Arsenal"
                    className="w-full bg-cream border border-hairline rounded-[4px] px-3 py-2 text-xs font-bold text-ink focus:outline-none focus:border-magenta"
                  />
                </label>
              </div>
            </div>

            {/* Seed Liquidity Section */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-ash font-mono font-bold">
                  {outcome1Label} Pool (SOL)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={yesLiquidity}
                  onChange={(e) => setYesLiquidity(e.target.value)}
                  disabled={saving}
                  className="w-full bg-sheet border border-hairline rounded-[4px] px-3 py-2 text-sm text-grass font-mono focus:outline-none focus:border-grass/50 disabled:opacity-50"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-ash font-mono font-bold">
                  {outcome2Label} Pool (SOL)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={noLiquidity}
                  onChange={(e) => setNoLiquidity(e.target.value)}
                  disabled={saving}
                  className="w-full bg-sheet border border-hairline rounded-[4px] px-3 py-2 text-sm text-magenta font-mono focus:outline-none focus:border-magenta/50 disabled:opacity-50"
                />
              </label>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-hairline">
              <button
                type="button"
                onClick={() => confirmApproval(0, 0)}
                disabled={saving}
                className="px-3 py-1.5 text-[11px] font-mono text-ash border border-hairline rounded-[4px] hover:text-ink hover:border-ink transition-all disabled:opacity-40 cursor-pointer"
              >
                Approve (0 SOL pool)
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalProposal(null)}
                  disabled={saving}
                  className="px-3 py-1.5 text-[11px] font-mono text-ash border border-hairline rounded-[4px] hover:text-ink transition-all disabled:opacity-40 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-[4px] bg-ink-fill text-white hover:bg-ink-fill/90 transition-all disabled:opacity-50 cursor-pointer active:scale-97"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {saving ? "Approving…" : "Approve & Launch"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.section>
  );
}
