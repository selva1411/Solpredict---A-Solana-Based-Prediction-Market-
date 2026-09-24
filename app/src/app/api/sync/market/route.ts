export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { applyMarketEvent } from "@/lib/indexer/reducer";
import { fetchMarketAccount } from "@/lib/indexer/onchain";
import { serverError, ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { syncMarketSchema } from "@/lib/schemas";
import { db } from "@/lib/db/client";
import { marketOutcomes, marketsCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isDevAuthEnabled } from "@/lib/dev-auth";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = syncMarketSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")
    );
  }

  const data = parsed.data;

  try {
    const onChain = await fetchMarketAccount(data.marketPubkey);
    if (!onChain) {
      // If the market is indexed in DB or running in dev environment, update the DB record gracefully
      if (db) {
        const [existing] = await db
          .select({ marketPubkey: marketsCache.marketPubkey })
          .from(marketsCache)
          .where(eq(marketsCache.marketPubkey, data.marketPubkey))
          .limit(1);

        if (existing || isDevAuthEnabled()) {
          await applyMarketEvent({
            type: "market",
            marketPubkey: data.marketPubkey,
            marketId: data.marketId ?? 0,
            question: data.question,
            description: data.description ?? "",
            category: data.category ?? "Crypto",
            status: data.status ?? "open",
            winningOutcome: data.winningOutcome ?? undefined,
            yesPoolLamports: data.yesPoolSol
              ? Math.round(data.yesPoolSol * 1e9)
              : undefined,
            noPoolLamports: data.noPoolSol
              ? Math.round(data.noPoolSol * 1e9)
              : undefined,
            endTs: data.endTs,
            resolveTs: data.resolveTs,
          });
          return ok({ ok: true, synced: true, source: "db_fallback" });
        }
      }

      return ok(
        {
          ok: false,
          error:
            "Market account does not exist on-chain; refusing to cache a phantom market",
        },
        { status: 400 } as ResponseInit
      );
    }

    const acc = onChain as unknown as Record<string, unknown>;
    const toNum = (v: unknown): number | undefined => {
      if (v === null || v === undefined) return undefined;
      if (typeof v === "object" && v !== null && "toNumber" in v) {
        return Number((v as { toNumber(): number }).toNumber());
      }
      return Number(v);
    };

    await applyMarketEvent({
      type: "market",
      marketPubkey: data.marketPubkey,
      marketId: data.marketId ?? 0,
      question: data.question,
      description: data.description ?? "",
      category: data.category ?? "Crypto",
      status: data.status ?? "open",
      winningOutcome: data.winningOutcome ?? undefined,
      // On-chain truth for every financial field — client values discarded.
      yesPoolLamports: toNum(acc.yesPoolLamports),
      noPoolLamports: toNum(acc.noPoolLamports),
      yesSupply: toNum(acc.yesSupply),
      noSupply: toNum(acc.noSupply),
      endTs: toNum(acc.endTs),
      resolveTs: toNum(acc.resolveTs),
    });

    if (db && data.outcomes && data.outcomes.length >= 2) {
      for (let i = 0; i < data.outcomes.length; i++) {
        await db
          .insert(marketOutcomes)
          .values({
            marketPubkey: data.marketPubkey,
            outcomeIndex: i,
            label: data.outcomes[i].trim(),
            lastPriceBps: 5000,
          })
          .onConflictDoNothing();
      }
    }

    return ok({ ok: true, synced: true, verified: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return ok({ ok: false, error: msg }, { status: 400 } as ResponseInit);
  }
});
