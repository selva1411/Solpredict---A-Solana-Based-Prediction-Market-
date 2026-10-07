export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";
import { ENV } from "@/lib/env";

const execAsync = promisify(exec);

const AUTHORITY_PUBKEY = "C3qdS5cuqU3C5MXipxYzA9ymKrcZxuS4RRMKhzVoozer";
const REQUIRED_SOL = 4.25;

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

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const connection = new Connection(ENV.serverRpcUrl, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });

  const authority = new PublicKey(AUTHORITY_PUBKEY);
  const balanceLamports = await connection.getBalance(authority).catch(() => 0);
  const balanceSol = balanceLamports / 1e9;
  const neededSol = Math.max(0, Number((REQUIRED_SOL - balanceSol).toFixed(4)));

  return ok({
    authority: AUTHORITY_PUBKEY,
    authorityBalance: balanceSol,
    requiredSol: REQUIRED_SOL,
    neededSol,
    isReady: neededSol <= 0,
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const connection = new Connection(ENV.serverRpcUrl, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });

  const authority = new PublicKey(AUTHORITY_PUBKEY);
  const balanceLamports = await connection.getBalance(authority);
  const balanceSol = balanceLamports / 1e9;

  if (balanceSol < 4.20) {
    const needed = (4.25 - balanceSol).toFixed(4);
    return badRequest(
      `Authority wallet needs ${needed} more SOL to pay the buffer rent & program extension. Please transfer ${needed} Devnet SOL to ${AUTHORITY_PUBKEY}.`
    );
  }

  const projectRoot = path.resolve(process.cwd(), "..");
  const programKeypair = path.join(projectRoot, "target", "deploy", "solpredict-keypair.json");
  const programSo = path.join(projectRoot, "target", "deploy", "solpredict.so");

  if (!fs.existsSync(programSo)) {
    return badRequest("Compiled program binary target/deploy/solpredict.so does not exist. Run cargo-build-sbf first.");
  }

  // Execute deployment with solana in PATH
  const solanaBinDir = path.join(os.homedir(), ".local", "share", "solana", "install", "active_release", "bin");
  const envPath = `${solanaBinDir}:${process.env.PATH || ""}`;
  const deployCmd = `solana program deploy --program-id "${programKeypair}" "${programSo}" --url devnet`;
  try {
    const { stdout, stderr } = await execAsync(deployCmd, {
      cwd: projectRoot,
      timeout: 180000, // 3 minutes timeout
      env: { ...process.env, PATH: envPath },
    });

    console.log("[Program Upgrade] Deploy stdout:", stdout);
    if (stderr) console.warn("[Program Upgrade] Deploy stderr:", stderr);

    // If refundWallet is provided, transfer back the temporary funds
    const refundWallet = body.refundWallet ? String(body.refundWallet) : null;
    const requestedRefund = Number(body.refundAmount || 0);

    let refunded = false;
    let refundedSol = 0;
    if (refundWallet) {
      try {
        const recipient = new PublicKey(refundWallet);
        const funder = getLocalKeypair();
        if (funder) {
          // Allow solana runtime a second to credit back the closed buffer rent
          await new Promise((r) => setTimeout(r, 1000));
          const currentBal = await connection.getBalance(funder.publicKey);
          // Keep 0.65 SOL authority baseline reserve
          const maxRefundable = Math.max(0, currentBal - Math.floor(0.65 * LAMPORTS_PER_SOL));
          let toRefund = requestedRefund > 0 ? Math.floor(requestedRefund * LAMPORTS_PER_SOL) : maxRefundable;
          if (toRefund > maxRefundable) toRefund = maxRefundable;

          if (toRefund > 50_000) {
            const tx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: funder.publicKey,
                toPubkey: recipient,
                lamports: toRefund - 5_000,
              })
            );
            await sendAndConfirmTransaction(connection, tx, [funder], { commitment: "confirmed" });
            refunded = true;
            refundedSol = Number(((toRefund - 5_000) / LAMPORTS_PER_SOL).toFixed(4));
          }
        }
      } catch (err: any) {
        console.warn("[Program Upgrade] Refund transfer failed:", err?.message);
      }
    }

    return ok({
      success: true,
      message: "Program 6HWVuwJuRrcynbusE5Av8czLz98WWqBYSYQ2hP2cjHXg successfully upgraded on Devnet!",
      output: stdout,
      refunded,
      refundedSol,
    });
  } catch (err: any) {
    console.error("[Program Upgrade] Deploy error:", err);
    return serverError(`Deploy command failed: ${err?.message || String(err)}`);
  }
});
