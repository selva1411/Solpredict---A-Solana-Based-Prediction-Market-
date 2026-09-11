export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db/client";
import { serverError, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { applyEvent } from "@/lib/indexer/reducer";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch rather than returning false,
  // and requires equal-length buffers.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const POST = apiHandler(
  async (req: NextRequest) => {
    if (!getDb()) return serverError("Database not configured");

    const secret = process.env.HELIUS_WEBHOOK_SECRET;
    if (!secret) {
      // Fail closed in every environment, not just production: an
      // unauthenticated webhook would let anyone inject fake trade events
      // into the indexer that the rest of the app treats as ground truth.
      // The instrumentation module already lists HELIUS_WEBHOOK_SECRET as
      // required in production; any other internet-reachable deployment
      // must configure it too.
      return ok({ error: "Webhook not configured" }, {
        status: 503,
      } as ResponseInit);
    }
    const authHeader = req.headers.get("authorization") ?? "";
    if (!safeEqual(authHeader, `Bearer ${secret}`) && !safeEqual(authHeader, secret)) {
      return ok({ error: "Unauthorized" }, { status: 401 } as ResponseInit);
    }

    const events = await req.json();
    if (!Array.isArray(events)) return ok({ ok: true, processed: 0 });

    let count = 0;
    for (const event of events) {
      const type = (event as Record<string, unknown>).type as
        | string
        | undefined;
      if (type !== "SWAP" && type !== "TRANSFER") continue;

      const tx = event as Record<string, unknown>;
      const tokenTransfers =
        (tx.tokenTransfers as Array<Record<string, unknown>>) || [];
      const nativeTransfers =
        (tx.nativeTransfers as Array<Record<string, unknown>>) || [];
      const signature = String(tx.signature ?? "");
      const timestamp = Number(tx.timestamp ?? Date.now());
      const feePayer = String(tx.feePayer ?? "");

      for (const transfer of tokenTransfers) {
        const mint = String(transfer.mint ?? "");
        const userAccount = String(transfer.userAccount ?? feePayer);
        const tokenAmount = Number(transfer.tokenAmount || 0);
        const nativeAmount =
          nativeTransfers.length > 0
            ? Number(
                (nativeTransfers[0] as Record<string, unknown>).amount || 0
              ) / 1e9
            : 0;

        await applyEvent({
          type: "trade",
          signature,
          marketPubkey: mint,
          trader: userAccount,
          side: tokenAmount > 0 ? "YES" : "NO",
          lamportsIn: Math.floor(nativeAmount * 1e9),
          tokensOut: tokenAmount,
          pricePerToken: tokenAmount > 0 ? nativeAmount / tokenAmount : 0,
          blockTime: timestamp,
          slot: 0,
        });
        count++;
      }
    }

    logAudit({
      action: "webhook:helius",
      actor: "helius",
      resource: "webhook",
      details: { processed: count },
      ip: req.headers.get("x-forwarded-for") ?? "unknown",
    });

    return ok({ ok: true, processed: count });
  },
  { rateLimit: false }
);

export const GET = apiHandler(async () => {
  return ok({
    status: "online",
    service: "SolPredict Helius Webhook Indexer",
    timestamp: new Date().toISOString(),
  });
});
