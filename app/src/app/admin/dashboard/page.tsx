"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  MessageSquare,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";

const AdminCharts = dynamic(
  () => import("@/components/dashboard/AdminCharts").then((m) => m.AdminCharts),
  { ssr: false }
);

interface DashboardData {
  stats: {
    markets: {
      total: number;
      open: number;
      resolved: number;
      totalVolume: number;
      totalLiquidity: number;
    };
    trades: { total: number; volume24h: number };
    users: { total: number };
    comments: { total: number };
  };
  recent: {
    markets: Array<{
      marketPubkey: string;
      question: string;
      category: string | null;
      status: string | null;
      createdAt: Date | null;
    }>;
    trades: Array<{
      id: number;
      trader: string;
      side: string | null;
      lamportsIn: number | null;
      blockTime: Date | null;
    }>;
    topTraders: Array<{
      wallet: string;
      username: string | null;
      volume: string | null;
      pnl: string | null;
    }>;
  };
}

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  color: "gold" | "verdigris" | "amber" | "green";
  delay?: number;
}

const colorMap = {
  gold: {
    bg: "bg-cyan/10",
    border: "border-cyan/20",
    icon: "text-cyan",
    accentBar: "bg-cyan",
  },
  verdigris: {
    bg: "bg-grass/10",
    border: "border-grass/20",
    icon: "text-grass",
    accentBar: "bg-grass",
  },
  amber: {
    bg: "bg-yellow/20",
    border: "border-yellow/30",
    icon: "text-ink",
    accentBar: "bg-yellow",
  },
  green: {
    bg: "bg-grass/10",
    border: "border-grass/20",
    icon: "text-grass",
    accentBar: "bg-grass",
  },
};

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  delay = 0,
}: StatCardProps) {
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-[8px] bg-cream border ${c.border} p-5 group border-t-4 ${c.accentBar}`}
    >
      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ash uppercase tracking-wider font-medium mb-2">
            {title}
          </p>
          <p className="text-2xl font-bold text-ink font-mono">{value}</p>
          {sub && <p className="text-xs text-ash-dim mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-[8px] ${c.bg} flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </motion.div>
  );
}

function RecentTable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="rounded-[8px] bg-cream border border-hairline p-5"
    >
      <h3 className="text-[13px] font-semibold text-ink mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-cyan" />
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = () => {
    setLoading(true);
    adminFetch("/api/admin/dashboard")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      )
      .then((json) => {
        setData(json);
        setLastUpdated(new Date());
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-[8px] bg-cream border border-hairline animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-[8px] bg-cream border border-hairline animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[8px] bg-magenta/10 border border-magenta/20 p-6 text-center">
        <p className="text-magenta text-[13px] mb-3">
          Failed to load dashboard: {error}
        </p>
        <button
          onClick={fetchData}
          className="text-xs px-4 py-2 rounded-[4px] bg-magenta/20 text-magenta hover:bg-magenta/30 transition-colors active:scale-97"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats;
  const recent = data?.recent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[21px] font-display font-extrabold text-ink">
            Dashboard Overview
          </h2>
          {lastUpdated && (
            <p className="text-xs text-ash-dim mt-1">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-[4px] bg-ink-fill-fill text-white hover:bg-ink-fill-fill/90 transition-all active:scale-97"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Markets"
          value={String(stats?.markets.total ?? 0)}
          sub={`${stats?.markets.open ?? 0} open · ${
            stats?.markets.resolved ?? 0
          } resolved`}
          icon={TrendingUp}
          color="gold"
          delay={0}
        />
        <StatCard
          title="24h Volume"
          value={`${(stats?.trades.volume24h ?? 0).toFixed(2)} SOL`}
          sub={`${stats?.trades.total ?? 0} total trades`}
          icon={DollarSign}
          color="verdigris"
          delay={0.05}
        />
        <StatCard
          title="Platform Users"
          value={String(stats?.users.total ?? 0)}
          icon={Users}
          color="amber"
          delay={0.1}
        />
        <StatCard
          title="Total Liquidity"
          value={`${(stats?.markets.totalLiquidity ?? 0).toFixed(1)} SOL`}
          sub={`${(stats?.markets.totalVolume ?? 0).toFixed(1)} SOL all-time`}
          icon={Activity}
          color="green"
          delay={0.15}
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-[8px] bg-cream border border-hairline p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-[8px] bg-cyan/10">
            <MessageSquare className="w-5 h-5 text-cyan" />
          </div>
          <div>
            <p className="text-xs text-ash uppercase tracking-wider">
              Comments
            </p>
            <p className="text-[21px] font-bold text-ink font-mono">
              {stats?.comments.total ?? 0}
            </p>
          </div>
        </div>
        <div className="rounded-[8px] bg-cream border border-hairline p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-[8px] bg-grass/10">
            <CheckCircle2 className="w-5 h-5 text-grass" />
          </div>
          <div>
            <p className="text-xs text-ash uppercase tracking-wider">
              Open Markets
            </p>
            <p className="text-[21px] font-bold text-ink font-mono">
              {stats?.markets.open ?? 0}
            </p>
          </div>
        </div>
        <div className="rounded-[8px] bg-cream border border-hairline p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-[8px] bg-inkblue/10">
            <Clock className="w-5 h-5 text-inkblue" />
          </div>
          <div>
            <p className="text-xs text-ash uppercase tracking-wider">
              Resolved
            </p>
            <p className="text-[21px] font-bold text-ink font-mono">
              {stats?.markets.resolved ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <AdminCharts />

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Markets */}
        <RecentTable title="Recent Markets">
          {!recent?.markets.length ? (
            <p className="text-xs text-ash-dim py-6 text-center">
              No markets yet.
            </p>
          ) : (
            <div className="space-y-2">
              {recent.markets.map((m) => (
                <div
                  key={m.marketPubkey}
                  className="flex items-start gap-3 p-3 rounded-[4px] hover:bg-ground/50 transition-colors"
                >
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-[4px] flex-shrink-0 ${
                      m.status === "open"
                        ? "bg-grass"
                        : m.status === "settled"
                        ? "bg-cyan"
                        : "bg-ash-dim"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink truncate">{m.question}</p>
                    <p className="text-[10px] text-ash-dim mt-0.5">
                      {m.category} · {m.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </RecentTable>

        {/* Top Traders */}
        <RecentTable title="Top Traders by Volume">
          {!recent?.topTraders.length ? (
            <p className="text-xs text-ash-dim py-6 text-center">
              No traders yet.
            </p>
          ) : (
            <div className="space-y-2">
              {recent.topTraders.map((t, i) => (
                <div
                  key={t.wallet}
                  className="flex items-center gap-3 p-2.5 rounded-[4px] hover:bg-ground/50 transition-colors"
                >
                  <span className="text-xs text-ash-dim font-mono w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="w-7 h-7 rounded-[4px] bg-ink-fill flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                    {t.wallet.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink font-mono truncate">
                      {t.username ||
                        `${t.wallet.slice(0, 6)}…${t.wallet.slice(-4)}`}
                    </p>
                  </div>
                  <span className="text-xs text-inkblue font-mono flex-shrink-0">
                    {Number(t.volume || 0).toFixed(1)} SOL
                  </span>
                </div>
              ))}
            </div>
          )}
        </RecentTable>
      </div>
    </div>
  );
}
