export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";
import os from "os";
import { ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { ENV } from "@/lib/env";

function getLocalKeypair(): Keypair | null {
  try {
    const keyPath = path.join(os.homedir(), ".config", "solana", "id.json");
    if (fs.existsSync(keyPath)) {
      const secret = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
      return Keypair.fromSecretKey(Uint8Array.from(secret));
    }
  } catch {
    // ignore
  }
  return null;
}

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const targetWallet = body.wallet;
  if (!targetWallet) {
    return badRequest("Missing target wallet address");
  }

  let recipient: PublicKey;
  try {
    recipient = new PublicKey(targetWallet);
  } catch {
    return badRequest("Invalid Solana public key");
  }

  const isLocal = ENV.isLocalnet;
  const connection = new Connection(ENV.serverRpcUrl, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });

  // 1. If localnet, use standard requestAirdrop
  if (isLocal) {
    try {
      const sig = await connection.requestAirdrop(recipient, 2 * LAMPORTS_PER_SOL);
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );
      const amountLamports = 2 * LAMPORTS_PER_SOL;
      try {
        const { creditLocalBalance } = await import("@/app/api/rpc/route");
        creditLocalBalance(targetWallet, amountLamports);
      } catch {
        // non-critical
      }
      return ok({
        success: true,
        signature: sig,
        amount: 2,
        amountLamports,
        network: "localnet",
      });
    } catch (err: any) {
      return ok({ success: false, error: err?.message || String(err) });
    }
  }

  // 2. Devnet: First try RPC requestAirdrop with 0.5 SOL
  try {
    const sig = await connection.requestAirdrop(recipient, 0.5 * LAMPORTS_PER_SOL);
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );
    const amountLamports = Math.round(0.5 * LAMPORTS_PER_SOL);
    try {
      const { creditLocalBalance } = await import("@/app/api/rpc/route");
      creditLocalBalance(targetWallet, amountLamports);
    } catch {
      // non-critical
    }
    return ok({
      success: true,
      signature: sig,
      amount: 0.5,
      amountLamports,
      source: "rpc",
    });
  } catch {
    // Devnet public RPC rate-limited or faucet dry, continue to fallback
  }

  // 3. Fallback to local server faucet keypair if available
  const funder = getLocalKeypair();
  if (funder) {
    try {
      const balance = await connection.getBalance(funder.publicKey);
      const dispenseLamports = 50_000_000; // 0.05 SOL
      if (balance > dispenseLamports + 10_000) {
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: funder.publicKey,
            toPubkey: recipient,
            lamports: dispenseLamports,
          })
        );
        const sig = await sendAndConfirmTransaction(connection, tx, [funder], {
          commitment: "confirmed",
        });
        try {
          const { creditLocalBalance } = await import("@/app/api/rpc/route");
          creditLocalBalance(targetWallet, dispenseLamports);
        } catch {
          // non-critical
        }
        return ok({
          success: true,
          signature: sig,
          amount: 0.05,
          amountLamports: dispenseLamports,
          source: "server_faucet",
        });
      }
    } catch (funderErr: any) {
      console.warn("[Faucet] Direct transfer failed:", funderErr?.message);
    }
  }

  // 4. Rate-limited and server pool dry: return rateLimited flag so UI opens interactive faucet modal
  return ok({
    success: false,
    rateLimited: true,
    error: "Devnet faucet rate limit reached on public RPC endpoints.",
    faucets: [
      {
        name: "Official Solana Faucet",
        url: `https://faucet.solana.com/?address=${recipient.toBase58()}`,
      },
      {
        name: "QuickNode Faucet",
        url: "https://faucet.quicknode.com/solana/devnet",
      },
      {
        name: "SolFaucet",
        url: "https://solfaucet.com/",
      },
    ],
  });
});
