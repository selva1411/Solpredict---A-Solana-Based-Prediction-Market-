"use client";

import { useEffect, useState } from "react";

export type TimeTone = "hot" | "soon" | "calm" | "over" | "na";

export interface TimeLeftProps {
  endDate: string;
  /** Optional custom renderer for the label once mounted. */
  className?: string;
}

function computeBucket(endDate: string | number | Date): { label: string; tone: TimeTone } {
  if (!endDate) return { label: "—", tone: "na" };
  let t = 0;
  if (endDate instanceof Date) {
    t = endDate.getTime();
  } else if (typeof endDate === "number") {
    t = endDate > 1e11 ? endDate : endDate * 1000;
  } else if (typeof endDate === "string") {
    const parsed = new Date(endDate).getTime();
    if (!Number.isNaN(parsed)) {
      t = parsed;
    } else {
      const n = Number(endDate);
      if (!Number.isNaN(n) && n > 0) {
        t = n > 1e11 ? n : n * 1000;
      }
    }
  }
  if (!t || Number.isNaN(t)) return { label: "—", tone: "na" };
  const ms = t - Date.now();
  if (ms <= 0) return { label: "closed", tone: "over" };
  const mins = ms / 60e3;
  if (mins < 60)
    return { label: `${Math.max(1, Math.round(mins))}m`, tone: "hot" };
  if (mins < 24 * 60)
    return { label: `${Math.round(mins / 60)}h`, tone: "soon" };
  return { label: `${Math.round(mins / (60 * 24))}d`, tone: "calm" };
}

/**
 * Time-to-close label that is hydration-safe by construction.
 *
 * The bucket derives from Date.now(), which ALWAYS differs at least slightly
 * between the server render and the client's first pass — and can cross a
 * minute/hour/day boundary in between, producing a text (or even structure,
 * via the hot-dot) mismatch that crashes hydration. So the first render on
 * BOTH sides emits an identical static placeholder; the real bucket appears
 * immediately after mount (~one frame later).
 */
export function TimeLeft({ endDate, className }: TimeLeftProps) {
  const [bucket, setBucket] = useState<{
    label: string;
    tone: TimeTone;
  } | null>(null);

  useEffect(() => {
    setBucket(computeBucket(endDate));
    const iv = setInterval(() => setBucket(computeBucket(endDate)), 30_000);
    return () => clearInterval(iv);
  }, [endDate]);

  const toneClass =
    bucket?.tone === "hot"
      ? "text-no font-bold"
      : bucket?.tone === "soon"
      ? "text-amber font-bold"
      : "text-ash";

  return (
    <span className={`${className ?? ""} num text-[12px] ${toneClass}`}>
      {bucket ? (
        <>
          {bucket.tone === "hot" && (
            <span className="live-dot !w-[5px] !h-[5px] mr-1" />
          )}
          {bucket.label}
        </>
      ) : (
        "…"
      )}
    </span>
  );
}
