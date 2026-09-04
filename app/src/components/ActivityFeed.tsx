"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useProgram } from "@/hooks/useProgram";
import { useRealtime } from "@/hooks/useRealtime";
import { shortAddr, timeUntil } from "@/lib/format";
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
  buy: "text-yes border-yes/30 bg-yes/5",
  sell: "text-no border-no/30 bg-no/5",
  claim: "text-cyan border-cyan/30 bg-cyan/5",
  refund: "text-ash border-hairline bg-sheet",
  settle: "text-inkblue border-inkblue/30 bg-inkblue/5",
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
        "inline-flex h-6 w-6 items-center justify-center rounded-[4px] border font-mono text-[10px] font-bold",
        TYPE_COLOR[type] ?? "text-ash border-hairline bg-sheet"
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

  useRealtime("global:activity", (payload: unknown) => {
    const entry = payload as ActivityEntry;
    setActivities((prev) => [entry, ...prev].slice(0, limit));
  });

  const fetchActivities = useCallback(async () => {
    const fetchFromDbApi = async () => {
      try {
        const res = await fetch("/api/activity/recent");
        if (!res.ok) return false;
        const data = await res.json();
        if (data && data.ok && data.activities?.length > 0) {
          const entries = data.activities.map((a: any) => ({
            id: a.signature,
            marketId: 0,
            marketQuestion:
              a.question ||
              (a.marketPubkey ? shortAddr(a.marketPubkey) : "Market Trade"),
            user: shortAddr(a.trader),
            type: a.side === "YES" || a.side === "NO" ? "buy" : "claim",
            side: a.side?.toLowerCase() as "yes" | "no" | undefined,
            timestamp: a.blockTime
              ? Math.floor(new Date(a.blockTime).getTime() / 1000)
              : Math.floor(Date.now() / 1000),
          }));
          setActivities(entries);
        } else {
          setActivities([]);
        }
      } catch {
        setActivities([]);
      }
    };

    if (!connection || !program?.programId) {
      await fetchFromDbApi();
      setLoading(false);
      return;
    }

    try {
      const entries: ActivityEntry[] = [];
      const sigs = await connection.getSignaturesForAddress(
        program.programId,
        { limit: 50 },
        "confirmed"
      );
      if (sigs.length === 0) throw new Error("empty");
      for (const sig of sigs.slice(0, limit)) {
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
            const marketMatch = logs.match(/market_(\d+)/i);
            entries.push({
              id: sig.signature,
              marketId: marketMatch ? parseInt(marketMatch[1]) : 0,
              marketQuestion: "",
              user: shortAddr(signer),
              type: "buy",
              timestamp: ts,
            });
          } else if (logs.includes("sell")) {
            entries.push({
              id: sig.signature,
              marketId: 0,
              marketQuestion: "",
              user: shortAddr(signer),
              type: "sell",
              timestamp: ts,
            });
          } else if (
            logs.includes("claim") ||
            logs.includes("RewardsClaimed")
          ) {
            entries.push({
              id: sig.signature,
              marketId: 0,
              marketQuestion: "",
              user: shortAddr(signer),
              type: "claim",
              timestamp: ts,
            });
          }
        } catch {}
      }
      if (entries.length > 0) {
        setActivities(entries);
      } else {
        await fetchFromDbApi();
      }
    } catch {
      await fetchFromDbApi();
    } finally {
      setLoading(false);
    }
  }, [connection, program, limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (loading) {
    return (
      <div className="space-y-3 py-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="surface h-12 shimmer" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-16 text-center font-mono text-[12px] text-ash-dim">
        No recent activity
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-hairline">
      {activities.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between gap-3 px-1 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <ActivityIcon type={a.type} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="num font-mono text-[12px] font-semibold text-ink">
                  {a.user}
                </span>
                <span className="font-mono text-[11px] text-ash">
                  {typeLabel(a.type)}
                </span>
              </div>
              {a.side && (
                <span
                  className={cn(
                    "font-mono text-[10px] font-bold",
                    a.side === "yes" ? "text-yes" : "text-no"
                  )}
                >
                  {a.side.toUpperCase()}
                </span>
              )}
              {a.marketQuestion && (
                <div className="truncate text-[11px] text-ash-dim max-w-[220px]">
                  {a.marketQuestion}
                </div>
              )}
            </div>
          </div>
          <span className="num font-mono text-[11px] text-ash-dim shrink-0">
            {timeUntil(a.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
