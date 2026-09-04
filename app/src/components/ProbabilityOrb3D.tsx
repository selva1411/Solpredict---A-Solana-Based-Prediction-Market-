"use client";

import React from "react";

interface ProbabilityOrb3DProps {
  yesProb: number;
  size?: number; // px (width)
}

/**
 * Semicircle probability gauge (SVG).
 * Sweeps a colored arc from 0% (NO, magenta, left) to 100% (YES, green, right)
 * behind a mechanical needle, with tick marks and a glowing hub.
 */
export default function ProbabilityOrb3D({
  yesProb,
  size = 120,
}: ProbabilityOrb3DProps) {
  const p = Math.max(0, Math.min(100, yesProb));
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const stroke = 12;

  // Semicircle arc centered on the bottom edge. Angle 0 = top, clockwise
  // positive; 0% points left (-90deg), 100% points right (+90deg).
  const arcAngle = (pct: number) => pct * 1.8 - 90;
  const pt = (angleDeg: number, radius: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.sin(rad),
      y: cy - radius * Math.cos(rad),
    };
  };

  const arcPath = (fromPct: number, toPct: number) => {
    const start = pt(arcAngle(fromPct), r);
    const end = pt(arcAngle(toPct), r);
    const large = toPct - fromPct > 50 ? 1 : 0;
    return `M ${start.x.toFixed(3)} ${start.y.toFixed(
      3
    )} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
  };

  const needleAngle = p * 1.8 - 90;

  // Ticks every 10%
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = arcAngle(i * 10);
    const outer = pt(a, r - 4);
    const inner = pt(a, r - (i % 2 === 0 ? 11 : 8));
    return { ...outer, inner, major: i % 2 === 0, idx: i };
  });

  const noProb = 100 - p;
  const endCap = pt(arcAngle(p), r);
  const boxH = size / 2 + 6;

  return (
    <div
      style={{ width: size }}
      className="flex flex-col items-center relative select-none"
    >
      <div className="relative" style={{ width: size, height: boxH }}>
        <svg
          width={size}
          height={boxH}
          viewBox={`0 0 ${size} ${boxH}`}
          className="overflow-visible drop-shadow-sm"
          role="img"
          aria-label={`${p}% YES, ${noProb}% NO probability`}
        >
          <defs>
            <linearGradient id="probArcGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-no)" />
              <stop offset="50%" stopColor="var(--color-amber)" />
              <stop offset="100%" stopColor="var(--color-yes)" />
            </linearGradient>
          </defs>

          {/* Track — a recessed groove that stays visible on light + dark */}
          <path
            d={arcPath(0, 100)}
            fill="none"
            stroke="var(--color-hairline-2)"
            strokeWidth={stroke}
            strokeLinecap="round"
            opacity={0.55}
          />

          {/* Colored value arc — gradient NO→YES */}
          <path
            d={arcPath(0, p)}
            fill="none"
            stroke="url(#probArcGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{
              transition: "d 0.6s ease",
              filter: "drop-shadow(0 1px 2px rgba(11,62,168,0.25))",
            }}
          />

          {/* Tick marks */}
          {ticks.map((t) => (
            <line
              key={t.idx}
              x1={t.x}
              y1={t.y}
              x2={t.inner.x}
              y2={t.inner.y}
              stroke={
                t.idx * 10 <= p
                  ? "color-mix(in srgb, var(--color-ink) 55%, white)"
                  : "var(--color-ash-dim)"
              }
              strokeWidth={t.major ? 2 : 1}
              strokeLinecap="round"
            />
          ))}

          {/* Value arc end-cap dot */}
          <circle
            cx={endCap.x}
            cy={endCap.y}
            r={5}
            fill={p >= 50 ? "var(--color-yes)" : "var(--color-no)"}
            stroke="var(--color-cream)"
            strokeWidth={2}
            style={{ transition: "all 0.6s ease" }}
          />

          {/* Center hub */}
          <circle cx={cx} cy={cy} r={stroke / 2 + 3} fill="var(--color-ink)" />
          <circle
            cx={cx}
            cy={cy}
            r={4}
            fill={p >= 50 ? "var(--color-yes)" : "var(--color-no)"}
            style={{ transition: "fill 0.6s ease" }}
          />
        </svg>

        {/* Needle (pivot aligns with hub at cy = size/2) */}
        <div
          className="absolute left-0"
          style={{
            width: size,
            height: size / 2,
            top: 0,
            transformOrigin: "50% 100%",
            transform: `rotate(${needleAngle}deg)`,
            transition: "transform 0.6s cubic-bezier(0.3, 0.8, 0.3, 1)",
            pointerEvents: "none",
          }}
        >
          <div
            className="mx-auto"
            style={{
              width: 3,
              height: r - stroke / 2 + 4,
              marginTop: 2,
              background:
                "linear-gradient(to top, var(--color-ink), var(--color-inkblue))",
              borderRadius: 2,
              boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
            }}
          />
        </div>
      </div>

      {/* 0% / 100% labels */}
      <div className="w-full flex justify-between px-1 mt-1 font-mono text-[9px] text-ash-dim">
        <span>0</span>
        <span>100</span>
      </div>

      {/* Numeric readout */}
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-[11px] font-bold text-no">
          {noProb}% NO
        </span>
        <span className="font-mono text-[9px] text-ash-dim">·</span>
        <span className="font-mono text-[13px] font-bold text-yes">
          {p}% YES
        </span>
      </div>
      <span className="text-[9px] uppercase font-display tracking-widest text-ash mt-0.5 font-bold">
        Probability
      </span>
    </div>
  );
}
