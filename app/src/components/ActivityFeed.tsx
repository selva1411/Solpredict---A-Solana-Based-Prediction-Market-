"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useProgram } from "@/hooks/useProgram";
import { useRealtime } from "@/hooks/useRealtime";
import { subscribeAppActivity } from "@/lib/sync-events";
import { shortAddr, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ActivityEntry {
  id: string;
  marketId: number;
  marketQuestion: string;
  user: string;
  type: "buy" | "sell" | "claim" | "refund" | "settle";
  side?: "yes" | "no";
  amount?: number;
  timestamp: number;
}

const TYPE_COLOR: Record<string, string> = {
  buy: "text-[#1D7C59] dark:text-[#52B788] border-[#BCDDCF] dark:border-[#1D7C59]/30 bg-[#EDF6F1] dark:bg-[rgba(29,124,89,0.15)]",
  sell: "text-[#B43C34] dark:text-[#E57373] border-[#ECCDC9] dark:border-[#B43C34]/30 bg-[#FBF1F0] dark:bg-[rgba(180,60,52,0.15)]",
  claim: "text-[#1F3A52] dark:text-[#7A9BB5] border-[#D5D2C8] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#21252A]",
  refund: "text-[#555D65] dark:text-[#9AA1AA] border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#21252A]",
  settle: "text-[#1F3A52] dark:text-[#7A9BB5] border-[#D5D2C8] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#21252A]",
};

function ActivityIcon({ type }: { type: string }) {
  const label =
    type === "buy"
      ? "B"
      : type === "sell"
      ? "S"
      : type === "claim"
      ? "C"
      : type === "refund"
      ? "R"
      : "?";
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-[3px] border font-mono text-[10px] font-bold shrink-0",
        TYPE_COLOR[type] ?? "text-[#555D65] dark:text-[#9AA1AA] border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#21252A]"
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    buy: "bought",
    sell: "sold",
    claim: "claimed",
    refund: "refunded",
    settle: "settled",
  };
  return labels[type] ?? type;
}

export default function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const { program, connection } = useProgram();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const activitiesRef = useRef(activities);
  activitiesRef.current = activities;

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(`/api/activity/recent?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.activities) && data.activities.length > 0) {
          const entries: ActivityEntry[] = data.activities.map((a: any) => ({
            id: a.signature,
            marketId: 0,
            marketQuestion:
              a.question ||
              (a.marketPubkey ? shortAddr(a.marketPubkey) : "Market Trade"),
            user: shortAddr(a.trader),
            type: a.side === "YES" || a.side === "NO" ? "buy" : "claim",
            side: a.side?.toLowerCase() as "yes" | "no" | undefined,
            amount: a.amountSol || (a.lamportsIn ? Math.abs(a.lamportsIn) / 1e9 : undefined),
            timestamp: a.blockTime
              ? Math.floor(new Date(a.blockTime).getTime() / 1000)
              : Math.floor(Date.now() / 1000),
          }));
          setActivities(entries);
          setLoading(false);
          return;
        }
      }
    } catch {
      /* fallback to onchain */
    }

    if (!connection || !program?.programId) {
      setLoading(false);
      return;
    }

    try {
      const entries: ActivityEntry[] = [];
      const sigs = await connection.getSignaturesForAddress(
        program.programId,
        { limit: Math.min(limit, 20) },
        "confirmed"
      );
      for (const sig of sigs.slice(0, 10)) {
        try {
          const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
          if (!tx?.meta?.logMessages) continue;
          const logs = tx.meta.logMessages.join(" ");
          const msg = tx.transaction.message as unknown as {
            staticAccountKeys?: import("@solana/web3.js").PublicKey[];
            accountKeys?: Array<{ toBase58(): string }>;
          };
          const signer =
            (msg.staticAccountKeys?.[0] ?? msg.accountKeys?.[0])?.toBase58() ??
            "";
          const ts = sig.blockTime ?? Math.floor(Date.now() / 1000);

          if (logs.includes("buy_shares") || logs.includes("purchased")) {
            entries.push({
              id: sig.signature,
              marketId: 0,
              marketQuestion: "Market Trade",
              user: shortAddr(signer),
              type: "buy",
              timestamp: ts,
            });
          } else if (logs.includes("sell")) {
            entries.push({
              id: sig.signature,
              marketId: 0,
              marketQuestion: "Market Trade",
              user: shortAddr(signer),
              type: "sell",
              timestamp: ts,
            });
          }
        } catch {}
      }
      if (entries.length > 0) {
        setActivities(entries);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [connection, program, limit]);

  // Universal Cross-Page & Cross-Tab Activity Listener
  useEffect(() => {
    const unsub = subscribeAppActivity(() => {
      void fetchActivities();
    });
    return () => unsub();
  }, [fetchActivities]);

  // Realtime push from WebSocket server
  const rt = useRealtime("global");
  useEffect(() => {
    const unsubActivity = rt.on("activity", () => {
      void fetchActivities();
    });
    const unsubTrades = rt.on("trades", () => {
      void fetchActivities();
    });
    return () => {
      unsubActivity?.();
      unsubTrades?.();
    };
  }, [rt, fetchActivities]);

  // Initial fetch + background safety poll
  useEffect(() => {
    fetchActivities();
    const timer = setInterval(fetchActivities, 8000);
    return () => clearInterval(timer);
  }, [fetchActivities]);

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-[#F1EFEA] dark:bg-[#21252A] rounded-[3px] animate-pulse" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-16 text-center font-mono text-[12px] text-[#7F8892] dark:text-[#68707B]">
        No recent activity detected
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-[#E2DFD7] dark:divide-[#2A2F36]">
      {activities.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between gap-3 px-1 py-3.5 hover:bg-[#F1EFEA]/80 dark:hover:bg-[#21252A]/80 transition-colors rounded-[3px]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <ActivityIcon type={a.type} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] font-semibold text-[#181A1C] dark:text-[#EAE8E3]">
                  {a.user}
                </span>
                <span className="font-mono text-[11px] text-[#7F8892] dark:text-[#9AA1AA]">
                  {typeLabel(a.type)}
                </span>
                {a.amount !== undefined && (
                  <span className="font-mono text-[11px] text-[#1F3A52] dark:text-[#7A9BB5] font-semibold">
                    {a.amount.toFixed(2)} SOL
                  </span>
                )}
              </div>
              {a.side && (
                <span
                  className={cn(
                    "font-mono text-[10px] font-bold mr-2",
                    a.side === "yes" ? "text-[#1D7C59] dark:text-[#52B788]" : "text-[#B43C34] dark:text-[#E57373]"
                  )}
                >
                  {a.side.toUpperCase()}
                </span>
              )}
              {a.marketQuestion && (
                <div className="truncate text-[12px] text-[#555D65] dark:text-[#9AA1AA] max-w-[320px] sm:max-w-md">
                  {a.marketQuestion}
                </div>
              )}
            </div>
          </div>
          <span className="font-mono text-[11px] text-[#7F8892] dark:text-[#68707B] shrink-0">
            {timeAgo(a.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
