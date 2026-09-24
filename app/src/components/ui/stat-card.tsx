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
      ? "text-[#1D7C59] dark:text-[#52B788]"
      : deltaTone === "neg"
      ? "text-[#B43C34] dark:text-[#E57373]"
      : "text-[#555D65] dark:text-[#9AA1AA]";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] p-4 transition-colors",
        className
      )}
    >
      <div className="relative flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#7F8892] dark:text-[#9AA1AA]">{label}</span>
        {delta && (
          <span className={`font-mono text-[10px] font-semibold ${deltaColor}`}>
            {delta}
          </span>
        )}
      </div>
      <div className="relative mt-2 font-mono font-bold text-[24px] leading-none tracking-tight text-[#181A1C] dark:text-[#EAE8E3]">
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
          className="relative mt-1.5 text-[11px] font-mono text-[#7F8892] dark:text-[#68707B]"
          suppressHydrationWarning
        >
          {hint}
        </div>
      )}
    </div>
  );
}
