import { getMarketPda } from "@/lib/pda";
import { ENV } from "@/lib/env";
import * as anchor from "@coral-xyz/anchor";

export interface SampleMarket {
  marketPubkey: string;
  marketId: number;
  creator: string | null;
  question: string;
  description: string | null;
  category: string;
  status: string;
  winningOutcome: string | null;
  resolutionSource: string | null;
  oracleFeedId: string | null;
  feeBps: number | null;
  totalVolume: number;
  openInterest: number;
  rentDepositLamports: string | null;
  rentReclaimedAt: string | null;
  endTs: string;
  resolveTs: string;
  settledAt: string | null;
  createdAt: string;
  thumbnailUrl: string | null;
  tags: string[];
  viewCount: number;
  watchlistCount: number;
  yesOdds: number;
  yesPoolSol: number;
  noPoolSol: number;
  yesPoolLamports: number;
  noPoolLamports: number;
  yesSupply: number;
  noSupply: number;
  totalPool: number;
  outcomes: Array<{
    outcomeIndex: number;
    label: string;
    sharesOutstanding: string | null;
    lastPriceBps: number | null;
    priceSol: number;
  }>;
}

function createSampleMarket(
  id: number,
  question: string,
  category: string,
  yesOdds: number,
  yesSol: number,
  noSol: number,
  volume: number,
  description: string,
  tags: string[]
): SampleMarket {
  const pda = getMarketPda(new anchor.BN(id), ENV.programId).toBase58();
  const yesLamports = Math.round(yesSol * 1e9);
  const noLamports = Math.round(noSol * 1e9);
  const totalPool = yesSol + noSol;
  const now = Date.now();
  const endTs = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const resolveTs = new Date(now + 31 * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    marketPubkey: pda,
    marketId: id,
    creator: "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
    question,
    description,
    category,
    status: "open",
    winningOutcome: null,
    resolutionSource: "pyth",
    oracleFeedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    feeBps: 100,
    totalVolume: volume,
    openInterest: totalPool,
    rentDepositLamports: "2500000",
    rentReclaimedAt: null,
    endTs,
    resolveTs,
    settledAt: null,
    createdAt,
    thumbnailUrl: null,
    tags,
    viewCount: Math.round(volume * 12 + 45),
    watchlistCount: Math.round(volume * 1.5 + 8),
    yesOdds,
    yesPoolSol: yesSol,
    noPoolSol: noSol,
    yesPoolLamports: yesLamports,
    noPoolLamports: noLamports,
    yesSupply: Math.round(yesSol * 1000),
    noSupply: Math.round(noSol * 1000),
    totalPool,
    outcomes: [
      {
        outcomeIndex: 0,
        label: "YES",
        sharesOutstanding: String(Math.round(yesSol * 1000)),
        lastPriceBps: yesOdds * 100,
        priceSol: yesOdds / 100,
      },
      {
        outcomeIndex: 1,
        label: "NO",
        sharesOutstanding: String(Math.round(noSol * 1000)),
        lastPriceBps: (100 - yesOdds) * 100,
        priceSol: (100 - yesOdds) / 100,
      },
    ],
  };
}

export const SAMPLE_MARKETS: SampleMarket[] = [
  createSampleMarket(
    1,
    "Will SOL trade above $250 by Dec 31, 2026?",
    "Crypto",
    68,
    45.5,
    21.4,
    184.2,
    "Market resolves to YES if the Pyth SOL/USD price feed trades at or above $250.00 at any time before settlement.",
    ["solana", "crypto", "price"]
  ),
  createSampleMarket(
    2,
    "Will Bitcoin exceed $120,000 before Q4 2026?",
    "Crypto",
    54,
    82.0,
    69.8,
    342.1,
    "Resolves to YES if BTC/USD Pyth index hits $120k prior to the end date.",
    ["bitcoin", "crypto", "all-time-high"]
  ),
  createSampleMarket(
    3,
    "Will SpaceX Starship land and catch the booster on the next flight?",
    "Tech",
    88,
    62.0,
    8.5,
    210.5,
    "Resolves to YES if SpaceX successfully catches Super Heavy booster using the launch tower chopstick arms.",
    ["spacex", "starship", "space", "tech"]
  ),
  createSampleMarket(
    4,
    "Will US Federal Reserve lower benchmark interest rate at next FOMC meeting?",
    "Politics",
    75,
    110.0,
    36.6,
    490.8,
    "Resolves based on the official Federal Reserve target rate announcement.",
    ["fed", "rates", "macro", "economy"]
  ),
  createSampleMarket(
    5,
    "Will Real Madrid win the 2026 UEFA Champions League?",
    "Sports",
    35,
    18.0,
    33.4,
    95.4,
    "Resolves to YES if Real Madrid CF lifts the UEFA Champions League trophy in the 2025/2026 season.",
    ["football", "champions-league", "sports"]
  ),
  createSampleMarket(
    6,
    "Will OpenAI announce GPT-5 before end of year?",
    "Tech",
    42,
    25.0,
    34.5,
    148.0,
    "Resolves to YES if OpenAI officially releases or announces GPT-5 for public or developer preview.",
    ["ai", "openai", "gpt5", "tech"]
  ),
  createSampleMarket(
    7,
    "Will Solana daily DEX volume flip Ethereum mainnet for 7 consecutive days?",
    "Crypto",
    62,
    38.0,
    23.3,
    155.6,
    "Resolves based on DeFiLlama tracked volume for Solana vs Ethereum L1.",
    ["solana", "ethereum", "dex", "defi"]
  ),
];
