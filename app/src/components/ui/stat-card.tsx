"use client";

import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface StatCardProps {
  /** Small uppercase tracked mono label. */
  label: string;
  /** The primary value (large). Use a plain number for animated numeric. */
  value: number;
  /** Formatting for the animated value. */
  decimals?: number;
  suffix?: string;
  prefix?: string;
  /** Optional inline delta showing relative change (e.g. "+2.4%"). */
  delta?: string;
  /** Optional supporting context line. */
  hint?: string;
  /** Positive/negative tone for the delta. */
  deltaTone?: "pos" | "neg";
  className?: string;
  /** When true, value is rendered statically (e.g. for huge/custom strings). */
  staticValue?: React.ReactNode;
  /** Optional solid color block accent (CMYK primary). */
  accent?: "cyan" | "magenta" | "yellow" | "grass" | "ink";
}

/**
 * StatCard — dense, data-first statistic block used across hero, markets,
 * portfolio and admin surfaces.
 */
export function StatCard({
  label,
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  delta,
  hint,
  deltaTone = "pos",
  className,
  staticValue,
  accent,
}: StatCardProps) {
  const deltaColor =
    deltaTone === "pos"
      ? "text-yes"
      : deltaTone === "neg"
      ? "text-no"
      : "text-ash";

  const accentBg: Record<string, string> = {
    cyan: "bg-cyan",
    magenta: "bg-magenta",
    yellow: "bg-yellow",
    grass: "bg-grass",
    ink: "bg-ink",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-cream border border-hairline rounded-[8px] shadow-panel p-5",
        className
      )}
    >
      {accent && (
        <>
          <div
            className={`absolute top-0 left-0 right-0 h-1 ${
              accentBg[accent] ?? ""
            }`}
          />
          <div
            className={`absolute top-0 left-0 right-0 h-8 opacity-[0.04] ${
              accentBg[accent] ?? ""
            }`}
          />
        </>
      )}
      <div className="relative flex items-center justify-between gap-2">
        <span className="label-lux">{label}</span>
        {delta && (
          <span className={`num font-mono text-[11px] font-bold ${deltaColor}`}>
            {delta}
          </span>
        )}
      </div>
      <div className="relative mt-2.5 font-display font-extrabold text-[28px] leading-none tracking-tight text-ink">
        {staticValue !== undefined ? (
          <span suppressHydrationWarning>{staticValue}</span>
        ) : (
          <AnimatedNumber
            value={value}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
          />
        )}
      </div>
      {hint && (
        <div
          className="relative mt-2 text-[12px] text-ash"
          suppressHydrationWarning
        >
          {hint}
        </div>
      )}
    </div>
  );
}
