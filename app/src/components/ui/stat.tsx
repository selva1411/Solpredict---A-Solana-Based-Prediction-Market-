"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  size = "md",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [k, setK] = useState(0);
  useEffect(() => setK((n) => n + 1), [value]);
  const sizes = { sm: "text-[22px]", md: "text-[34px]", lg: "text-[64px]" };
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-[#7F8892] dark:text-[#68707B]">{label}</div>
      {/* Live numbers can legitimately change between the server render and
          client hydration (a stats refetch can land mid-hydration), which
          React would otherwise flag as a hydration mismatch. The value is
          cosmetic — the client value wins after hydration. */}
      <div
        key={k}
        suppressHydrationWarning
        className={cn(
          "num tick font-extrabold mt-2.5 text-[#181A1C] dark:text-[#EAE8E3] font-sans tracking-tight",
          size === "lg" && "leading-[.95]",
          sizes[size]
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-2 text-[12px] font-mono text-[#7F8892] dark:text-[#68707B]">{hint}</div>}
    </div>
  );
}
