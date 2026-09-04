"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { adminFetch } from "@/lib/admin-client";

interface DailyVolumePoint {
  date: string;
  volume: number;
}

interface CategoryRow {
  category: string | null;
  count: number;
  volume: number;
}

interface StatsResponse {
  ok?: boolean;
  stats?: {
    dailyVolume?: DailyVolumePoint[];
    categoryBreakdown?: CategoryRow[];
  };
}

const COLORS = [
  "var(--color-cyan)",
  "var(--color-magenta)",
  "var(--color-yellow)",
  "var(--color-grass)",
  "var(--color-inkblue)",
  "var(--color-ink)",
  "var(--color-ash)",
  "var(--color-ash-dim)",
];

export function AdminCharts() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminFetch("/api/admin/stats")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      )
      .then((json: StatsResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // /api/admin/stats returns { ok, stats: { dailyVolume, categoryBreakdown } }.
  const dailyVolume = data?.stats?.dailyVolume ?? [];
  const categoryBreakdown = data?.stats?.categoryBreakdown ?? [];

  if (error) {
    return (
      <div className="rounded-[8px] bg-cream border border-hairline p-6 text-xs text-ash">
        Unable to load chart data.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-[8px] bg-cream border border-hairline p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider font-display text-ink mb-4">
          Volume Trend (30 Days)
        </h3>
        {dailyVolume.length === 0 ? (
          <p className="text-xs text-ash py-10 text-center">
            No trading volume in the last 30 days.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyVolume}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-hairline)"
              />
              <XAxis
                dataKey="date"
                stroke="var(--color-ash-dim)"
                fontSize={10}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                stroke="var(--color-ash-dim)"
                fontSize={10}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-cream)",
                  border: "1px solid var(--color-hairline)",
                  borderRadius: "8px",
                  fontSize: 12,
                  color: "var(--color-ink)",
                }}
                labelFormatter={(l) => `Date: ${String(l)}`}
                formatter={(value) => [
                  `${Number(value).toFixed(2)} SOL`,
                  "Volume",
                ]}
              />
              <Line
                type="monotone"
                dataKey="volume"
                stroke="var(--color-inkblue)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-[8px] bg-cream border border-hairline p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider font-display text-ink mb-4">
          Category Breakdown
        </h3>
        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-ash py-10 text-center">
            No markets cached yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={categoryBreakdown}
                dataKey="volume"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
              >
                {categoryBreakdown.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-cream)",
                  border: "1px solid var(--color-hairline)",
                  borderRadius: "8px",
                  fontSize: 12,
                  color: "var(--color-ink)",
                }}
                formatter={(value, name) => [
                  `${Number(value).toFixed(2)} SOL`,
                  String(name),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
