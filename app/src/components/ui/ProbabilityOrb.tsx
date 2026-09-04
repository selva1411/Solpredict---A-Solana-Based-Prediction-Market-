"use client";

/**
 * ProbabilityOrb — a strong, tonal, center-value probability display.
 *
 * Emits the YES probability as a bold center number over a two-tone split disk
 * (green = YES share, neutral/void = complement). Deliberately avoids gradients,
 * glow, and reliance on color alone: the number is always rendered, the layout
 * is perceivable in greyscale, and reduced-motion users get a static value.
 */

interface ProbabilityOrbProps {
  /** YES probability as a fraction in [0,1]. */
  yesProb: number;
  /** Optional size in pixels for the orb. */
  size?: number;
  className?: string;
}

export function ProbabilityOrb({
  yesProb,
  size = 220,
  className = "",
}: ProbabilityOrbProps) {
  const yesPct = Math.round(yesProb * 100);
  const noPct = 100 - yesPct;

  return (
    <div
      className={`flex flex-col items-center gap-4 ${className}`}
      role="img"
      aria-label={`YES market probability ${yesPct} percent, NO ${noPct} percent`}
    >
      <div
        className="relative rounded-full border border-hairline overflow-hidden"
        style={{ width: size, height: size }}
      >
        {/* Complement (NO) base */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "var(--color-cream)" }}
          aria-hidden
        />
        {/* YES share — grass wedge from the left, sized by probability */}
        <div
          className="absolute inset-0"
          style={{
            background: "var(--color-yes)",
            clipPath: `polygon(0 0, ${100 - yesPct}% 0, ${
              100 - yesPct
            }% 100%, 0 100%)`,
            opacity: 0.9,
          }}
          aria-hidden
        />
        {/* Inner center plate for the big number */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink"
          style={{
            width: 82,
            height: 82,
            backgroundColor: "var(--color-sheet)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <span
            className="num font-display font-extrabold text-ink leading-none"
            style={{ fontSize: "clamp(20px, 4cqw, 26px)" }}
          >
            {yesPct}%
          </span>
          <span className="mt-1 font-mono text-[8px] uppercase tracking-[.16em] text-ash">
            YES
          </span>
        </div>
      </div>

      {/* Supporting YES / NO values (not color-only) */}
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <div className="font-mono text-[9px] uppercase tracking-[.16em] text-ash">
            YES
          </div>
          <div className="num font-display font-extrabold text-[20px] text-yes leading-tight">
            {yesPct}%
          </div>
        </div>
        <div className="w-px h-6 bg-hairline" aria-hidden />
        <div className="text-center">
          <div className="font-mono text-[9px] uppercase tracking-[.16em] text-ash">
            NO
          </div>
          <div className="num font-display font-extrabold text-[20px] text-no leading-tight">
            {noPct}%
          </div>
        </div>
      </div>
    </div>
  );
}
