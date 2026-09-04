"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import { Scale, Loader2, RefreshCw } from "lucide-react";
import { adminFetch } from "@/lib/admin-client";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

interface DisputeRow {
  id: number;
  marketPubkey: string;
  marketQuestion: string | null;
  disputer: string;
  reason: string;
  evidence: string | null;
  status: string;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
}

export function DisputesSection() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/disputes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDisputes(data.disputes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const resolveDispute = async (
    id: number,
    status: "resolved" | "rejected"
  ) => {
    const resolution =
      window
        .prompt(`Resolution note for dispute #${id} (optional):`, "")
        ?.trim() ?? null;
    setResolvingId(id);
    try {
      const res = await adminFetch("/api/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          resolution: resolution || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchDisputes();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resolve dispute"
      );
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <motion.section
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-cream border border-hairline rounded-[8px] shadow-sm p-8"
      >
        <div className="flex items-center justify-center gap-3 text-ash">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-mono">Loading disputes...</span>
        </div>
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-magenta" />
          <span className="w-1.5 h-5 bg-magenta rounded-[1px]" />
          <h2 className="text-[21px] font-display font-extrabold uppercase tracking-wider text-ink">
            Disputes ({disputes.length})
          </h2>
        </div>
        <button
          onClick={fetchDisputes}
          className="inline-flex items-center gap-2 text-xs text-ash hover:text-ink transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-magenta font-mono">{error}</p>}

      {disputes.length === 0 ? (
        <div className="bg-cream border border-hairline rounded-[8px] shadow-sm p-8 text-center">
          <p className="text-[13px] text-ash">No disputes filed yet.</p>
        </div>
      ) : (
        <div className="bg-cream border border-hairline rounded-[8px] shadow-sm overflow-hidden">
          <div className="divide-y divide-hairline">
            {disputes.map((d) => (
              <div key={d.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">#{d.id}</span>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-[4px] ${
                        d.status === "pending"
                          ? "bg-yellow/30 text-ink border border-yellow/40"
                          : d.status === "resolved"
                          ? "bg-grass/10 text-grass border border-grass/20"
                          : "bg-magenta/10 text-magenta border border-magenta/20"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-ash">
                    {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
                  </span>
                </div>
                <p className="text-xs text-cyan font-mono break-all">
                  {d.marketQuestion || d.marketPubkey}
                </p>
                <p className="text-xs text-ink">
                  <span className="text-ash">Disputer:</span>{" "}
                  <span className="font-mono">
                    {d.disputer.slice(0, 6)}...{d.disputer.slice(-4)}
                  </span>
                </p>
                <p className="text-xs text-ash">Reason: {d.reason}</p>
                {d.evidence && (
                  <p className="text-[10px] text-ash italic">
                    Evidence: {d.evidence}
                  </p>
                )}
                {d.resolution && (
                  <p className="text-[10px] text-grass font-mono">
                    Resolution: {d.resolution} — by {d.resolvedBy}
                  </p>
                )}
                {d.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => resolveDispute(d.id, "resolved")}
                      disabled={resolvingId === d.id}
                      className="text-[10px] py-1 px-3 rounded-[4px] border border-grass/40 text-grass hover:bg-grass/10 transition-colors disabled:opacity-50 active:scale-97"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => resolveDispute(d.id, "rejected")}
                      disabled={resolvingId === d.id}
                      className="text-[10px] py-1 px-3 rounded-[4px] border border-magenta/40 text-magenta hover:bg-magenta/10 transition-colors disabled:opacity-50 active:scale-97"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
