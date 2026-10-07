import type { Metadata } from "next";
import { Connection, PublicKey } from "@solana/web3.js";
import { ENV } from "@/lib/env";

import { getMarket } from "@/lib/data/markets";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function parseMarketQuestion(
  marketPda: PublicKey
): Promise<string | null> {
  try {
    const connection = new Connection(ENV.serverRpcUrl, {
      commitment: "confirmed",
      disableRetryOnRateLimit: true,
    });
    const accountInfoPromise = connection.getAccountInfo(marketPda);
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("RPC timeout")), 1500)
    );
    const accountInfo = await Promise.race([accountInfoPromise, timeoutPromise]);
    if (!accountInfo) return null;

    const data = accountInfo.data;
    // Borsh layout: 8(disc) + 8(market_id u64 LE) + 32(authority pubkey)
    const qLenOffset = 8 + 8 + 32;
    if (data.length < qLenOffset + 4) return null;
    const qLen = data.readUInt32LE(qLenOffset);
    if (data.length < qLenOffset + 4 + qLen) return null;
    const question = data.toString(
      "utf8",
      qLenOffset + 4,
      qLenOffset + 4 + qLen
    );
    return question;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;

    // 1. Fast indexed DB lookup first (avoids hitting Solana RPC rate limits on SSR / prefetching)
    try {
      const market = await getMarket(id);
      if (market?.question) {
        return buildMetadata(market.question);
      }
    } catch {
      // Fall through to on-chain fallback
    }

    // 2. On-chain fallback if not in DB
    try {
      const marketPda = new PublicKey(id);
      const question = await parseMarketQuestion(marketPda);
      if (question) {
        return buildMetadata(question);
      }
    } catch {
      // Fall through to default
    }
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Market — SOLPredict",
    description: "Decentralized prediction market on Solana Devnet.",
  };
}

function buildMetadata(question: string): Metadata {
  const title = `${question} — SOLPredict`;
  const description = `Trade YES/NO on SOLPredict. Fully on-chain prediction market settled by Pyth oracles on Solana Devnet.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "SOLPredict",
      images: [
        {
          url: "/icon.png",
          width: 1024,
          height: 1024,
          alt: question,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/icon.png"],
    },
  };
}

export default function MarketLayout({ children, params }: Props) {
  return children;
}
