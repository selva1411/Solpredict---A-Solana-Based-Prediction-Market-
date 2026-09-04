"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  TrendingUp,
  Flame,
  Zap,
  DollarSign,
  Plus,
  Brain,
  Trophy,
  Vote,
  Crown,
  Lock,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { LabelLux } from "@/components/ui/label-lux";
import { keys } from "@/lib/api/keys";
import { cn } from "@/lib/utils";

const ACHIEVEMENTS = [
  {
    key: "first_trade",
    icon: TrendingUp,
    title: "First Trade",
    desc: "Place your first trade",
  },
  {
    key: "first_win",
    icon: Award,
    title: "First Win",
    desc: "Win your first market",
  },
  {
    key: "streak_3",
    icon: Flame,
    title: "Hot Streak",
    desc: "Win 3 markets in a row",
  },
  {
    key: "streak_10",
    icon: Zap,
    title: "Unstoppable",
    desc: "Win 10 markets in a row",
  },
  {
    key: "whale_100",
    icon: DollarSign,
    title: "Whale",
    desc: "Single trade > $100",
  },
  {
    key: "whale_1k",
    icon: DollarSign,
    title: "Mega Whale",
    desc: "Single trade > $1,000",
  },
  {
    key: "market_creator",
    icon: Plus,
    title: "Market Creator",
    desc: "Propose an approved market",
  },
  {
    key: "oracle_whisperer",
    icon: Brain,
    title: "Oracle Whisperer",
    desc: "Win 5 crypto markets",
  },
  {
    key: "sports_savant",
    icon: Trophy,
    title: "Sports Savant",
    desc: "Win 5 sports markets",
  },
  {
    key: "politico",
    icon: Vote,
    title: "Politico",
    desc: "Win 5 politics markets",
  },
  {
    key: "top_10_weekly",
    icon: Crown,
    title: "Top 10",
    desc: "Top 10 in weekly leaderboard",
  },
];

interface AchievementStatus {
  key: string;
  unlocked: boolean;
  progress: number;
}

export default function RewardsPage() {
  const { publicKey } = useWallet();
  const [statuses, setStatuses] = useState<Record<string, AchievementStatus>>(
    {}
  );

  const walletStr = publicKey?.toBase58() ?? null;

  const { isLoading } = useQuery({
    queryKey: keys.user.achievements(walletStr ?? "none"),
    queryFn: async () => {
      const r = await fetch(`/api/user/achievements?wallet=${walletStr}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data?.ok && data.achievements) {
        const map: Record<string, AchievementStatus> = {};
        data.achievements.forEach((a: any) => {
          map[a.key] = {
            key: a.key,
            unlocked: a.unlocked,
            progress: a.progress,
          };
        });
        setStatuses(map);
      }
      return data;
    },
    enabled: !!walletStr,
    staleTime: 30_000,
  });
  const loading = !!walletStr ? isLoading : false;

  const unlockedCount = Object.values(statuses).filter(
    (s) => s.unlocked
  ).length;

  if (!publicKey) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-10">
        <div className="bg-cream border border-hairline rounded-[8px] shadow-sm p-14 text-center max-w-md mx-auto">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full border-2 border-magenta/40 bg-magenta/10 mb-5">
            <Award className="w-6 h-6 text-magenta" aria-hidden />
          </span>
          <h2 className="font-display text-[20px] font-extrabold uppercase mb-2 text-ink">
            Connect your wallet
          </h2>
          <p className="text-[13px] text-ash mb-6">
            Connect to view your achievement gallery.
          </p>
          <ClientWalletButton />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-4 h-4 text-magenta" aria-hidden />
          <LabelLux className="!text-magenta">Rewards</LabelLux>
        </div>
        <h1 className="font-display text-[34px] font-extrabold text-ink tracking-tight">
          Achievements
        </h1>
        <p className="text-[13px] text-ash mt-1">
          {!loading && statuses
            ? `${unlockedCount} of ${ACHIEVEMENTS.length} unlocked`
            : "Tracking your progress across all markets"}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-cream border border-hairline rounded-[8px] h-44 shimmer"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {ACHIEVEMENTS.map((ach) => {
            const Icon = ach.icon;
            const status = statuses[ach.key] ?? {
              key: ach.key,
              unlocked: false,
              progress: 0,
            };
            return (
              <div
                key={ach.key}
                className={cn(
                  "bg-cream border border-hairline rounded-[8px] shadow-sm p-5 flex flex-col items-center text-center gap-3 transition-all relative",
                  !status.unlocked && "opacity-50 grayscale"
                )}
              >
                {!status.unlocked && (
                  <span className="absolute top-3 right-3" aria-hidden>
                    <Lock className="w-3 h-3 text-ash-dim" />
                  </span>
                )}
                <div
                  className={cn(
                    "w-12 h-12 rounded-[8px] border-2 flex items-center justify-center",
                    status.unlocked
                      ? "border-cyan/40 bg-cyan/10"
                      : "border-hairline bg-sheet"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5",
                      status.unlocked ? "text-cyan" : "text-ash-dim"
                    )}
                  />
                </div>
                <div>
                  <h3 className="font-display text-[13px] font-bold text-ink leading-tight">
                    {ach.title}
                  </h3>
                  <p className="text-[11px] text-ash mt-1">{ach.desc}</p>
                </div>
                {/* Progress bar */}
                <div
                  className="w-full h-1 bg-sheet rounded-full overflow-hidden"
                  aria-label={`Progress: ${status.progress}%`}
                >
                  <div
                    className="h-full rounded-full bg-grass transition-all duration-500"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
                <span className="num font-mono text-[10px] text-ash-dim">
                  {status.unlocked ? "Unlocked" : `${status.progress}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
