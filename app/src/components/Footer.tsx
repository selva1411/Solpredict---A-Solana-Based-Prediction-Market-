"use client";

import Link from "next/link";
import { ShieldCheck, Cpu, ExternalLink, Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#16181C] text-[#555D65] dark:text-[#9AA1AA]">
      <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Col 1: Brand & Thesis */}
          <div className="md:col-span-2 space-y-3.5">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="w-5 h-5 rounded-[2px] bg-[#1F3A52] flex items-center justify-center font-mono font-bold text-[11px] text-white">
                SP
              </span>
              <span className="font-mono text-[13px] font-bold tracking-wider text-[#181A1C] dark:text-[#EAE8E3]">
                SOLPREDICT
              </span>
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-[2px] bg-[#F1EFEA] dark:bg-[#21252A] text-[#555D65] dark:text-[#9AA1AA] border border-[#E2DFD7] dark:border-[#2A2F36]">
                AMM v1
              </span>
            </Link>
            <p className="text-[12px] text-[#7F8892] dark:text-[#68707B] max-w-md leading-relaxed font-sans">
              Decentralized, non-custodial prediction exchange engineered on the Solana high-throughput network.
              Constant product AMM pools, sub-second Pyth oracle settlement, and transparent on-chain liquidity.
            </p>
            <div className="flex items-center gap-3 pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2A2F36] text-[10px] font-mono text-[#1D7C59] dark:text-[#52B788]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D7C59]" />
                Devnet Operational
              </span>
              <span className="text-[10px] font-mono text-[#7F8892] dark:text-[#68707B]">
                Latency: ~400ms
              </span>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div className="space-y-2.5 font-sans">
            <h4 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#181A1C] dark:text-[#EAE8E3]">
              Exchange
            </h4>
            <ul className="space-y-1.5 text-[12px]">
              <li>
                <Link href="/markets" className="text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors">
                  All Markets
                </Link>
              </li>
              <li>
                <Link href="/portfolio" className="text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors">
                  Portfolio & Positions
                </Link>
              </li>
              <li>
                <Link href="/proposals" className="text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors">
                  Community Proposals
                </Link>
              </li>
              <li>
                <Link href="/activity" className="text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors">
                  Order Flow Activity
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors">
                  Trader Leaderboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Architecture & Resources */}
          <div className="space-y-2.5 font-sans">
            <h4 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#181A1C] dark:text-[#EAE8E3]">
              Protocol Stack
            </h4>
            <ul className="space-y-1.5 text-[12px]">
              <li className="flex items-center gap-1.5 text-[#7F8892] dark:text-[#68707B]">
                <Cpu className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
                <span>Anchor Solana Program</span>
              </li>
              <li className="flex items-center gap-1.5 text-[#7F8892] dark:text-[#68707B]">
                <Zap className="w-3.5 h-3.5 text-[#1D7C59] dark:text-[#52B788]" />
                <span>Pyth Low-Latency Feeds</span>
              </li>
              <li className="flex items-center gap-1.5 text-[#7F8892] dark:text-[#68707B]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
                <span>CPMM Bonding Logic</span>
              </li>
              <li>
                <a
                  href="https://explorer.solana.com/?cluster=devnet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors"
                >
                  Solana Explorer <ExternalLink className="w-3 h-3 text-[#7F8892] dark:text-[#68707B]" />
                </a>
              </li>
              <li>
                <a
                  href="https://pyth.network/developers/price-feed-ids"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] transition-colors"
                >
                  Pyth Oracle Feeds <ExternalLink className="w-3 h-3 text-[#7F8892] dark:text-[#68707B]" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom separator and legal / technical note */}
        <div className="pt-5 border-t border-[#E2DFD7] dark:border-[#2A2F36] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-[#7F8892] dark:text-[#68707B]">
          <div>
            © {new Date().getFullYear()} SolPredict Protocol. All on-chain transactions execute trustlessly via Solana smart contracts.
          </div>
          <div className="flex items-center gap-3">
            <span>Cluster: Devnet</span>
            <span className="h-3 w-px bg-[#E2DFD7] dark:bg-[#2A2F36]" />
            <span>Anchor v0.30</span>
            <span className="h-3 w-px bg-[#E2DFD7] dark:bg-[#2A2F36]" />
            <span className="text-[#1D7C59] dark:text-[#52B788]">Oracle Verified</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
