"use client";
import ActivityFeed from "@/components/ActivityFeed";

export default function ActivityPage() {
  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-8 text-ink">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-yes animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-ash">
            Realtime Audit Log
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Exchange Trade Tape
        </h1>
        <p className="text-[13px] text-ash mt-1 font-mono">
          Settled fills, liquidations, and token emissions across all prediction contracts
        </p>
      </div>
      <div className="bg-cream border border-hairline rounded-xl p-5 shadow-sm">
        <ActivityFeed limit={50} />
      </div>
    </main>
  );
}
