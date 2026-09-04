"use client";

import React, { useState } from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "yes-no",
    eyebrow: "How it works",
    title: "Conviction, priced.",
    desc: "Every market asks a simple question with two outcomes. Buy shares in the answer you believe — winning shares pay out in SOL from the treasury.",
    points: [
      "YES or NO — priced in real time",
      "Constant-product pricing, no hidden spread",
      "Settle automatically via Pyth oracles",
    ],
    accent: true,
    barColor: "bg-cyan",
  },
  {
    id: "trade",
    eyebrow: "Getting started",
    title: "Trade a probability, not a coin",
    desc: "Each share costs a fraction of 1 SOL based on how likely the market thinks an outcome is. The odds respond to every trade — buy low, cash out high.",
    points: [
      "Understand the odds in seconds",
      "You see price impact before you commit",
      "Cash out winning positions at any time",
    ],
    accent: false,
    barColor: "bg-magenta",
  },
  {
    id: "connect",
    eyebrow: "One step left",
    title: "Connect your Solana wallet",
    desc: "Connect a Phantom or any wallet-standard wallet to start trading. Your funds stay in your wallet until you trade.",
    points: [
      "Phantom, Solflare & more",
      "Self-custodial, non-custodial by design",
      "Localnet faucet ready when you are",
    ],
    accent: false,
    barColor: "bg-grass",
  },
];

export default function GatewayPage() {
  const [slide, setSlide] = useState(0);
  const current = STEPS[slide];

  return (
    <main className="mx-auto w-full min-h-screen flex items-center justify-center px-4 sm:px-6 py-14">
      <div className="bg-cream border border-hairline rounded-[8px] shadow-sm p-6 sm:p-10 max-w-xl w-full border-t-4 border-t-cyan">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-8">
          <span className="font-display font-bold text-[18px] tracking-tight text-ink">
            SOL<span className="text-magenta">PREDICT</span>
          </span>
          <span className="ml-2 h-px flex-1 bg-hairline" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[.16em] text-ash-dim">
            Onboarding
          </span>
        </div>

        {/* Eyebrow */}
        <div className="label-lux mb-3">{current.eyebrow}</div>

        <h1
          className="font-display font-extrabold text-ink mb-4"
          style={{
            fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {current.accent ? (
            <>
              Conviction,
              <br />
              <span className="text-cyan">priced.</span>
            </>
          ) : (
            current.title
          )}
        </h1>

        <p className="text-[15px] text-ash leading-relaxed mb-6">
          {current.desc}
        </p>

        {current.points && (
          <ul className="space-y-2.5 mb-8">
            {current.points.map((p) => (
              <li
                key={p}
                className="flex items-start gap-2.5 text-[13px] text-ink"
              >
                <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full border-2 border-grass/40 bg-grass/10 shrink-0">
                  <Check className="w-3 h-3 text-grass" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        )}

        {/* Progress dots */}
        <div
          className="flex items-center justify-center gap-2 mb-8"
          role="tablist"
          aria-label="Onboarding steps"
        >
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={slide === i}
              aria-label={`Step ${i + 1}: ${s.eyebrow}`}
              onClick={() => setSlide(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === slide
                  ? "w-8 bg-ink-fill"
                  : "w-2 bg-hairline-2 hover:bg-hairline"
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {slide > 0 && (
            <button
              onClick={() => setSlide(slide - 1)}
              className="inline-flex items-center justify-center w-11 h-11 rounded-[8px] border-2 border-ink text-ink hover:bg-yellow hover:text-ink-static transition-colors cursor-pointer snap"
              aria-label="Previous step"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {slide < STEPS.length - 1 ? (
            <button
              onClick={() => setSlide(slide + 1)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 h-11 rounded-[8px] bg-ink-fill hover:bg-ink-fill-fill-soft text-white text-[14px] font-semibold transition-colors cursor-pointer snap"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex-1">
              <ClientWalletButton />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
