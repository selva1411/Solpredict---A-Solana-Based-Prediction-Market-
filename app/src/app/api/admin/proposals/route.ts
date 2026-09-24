export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketsCache, marketProposals } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import {
  createMarketInDb,
  settleMarketInDb,
  getAllMarkets,
} from "@/lib/db/markets-store";
import { requireAdmin } from "@/lib/admin-guard";
import { logAuditEntry } from "@/lib/data/admin";
import { getClientIp } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if ("response" in guard) return guard.response;

  try {
    if (!db) {
      const allMarkets = await getAllMarkets({ limit: 100 });
      const mockProposals = [
        {
          id: "1",
          proposalPubkey: "Prop111111111111111111111111111111111111111",
          creator: "7Y2gCvbXqK1Z2MrF4tH9sPqN6B8aV3eW5xL0mJ4kL9",
          question: "Will ETH transition to single-slot finality in 2026?",
          description: "Resolves YES if Ethereum mainnet deploys single-slot finality.",
          category: "Crypto",
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          status: "pending",
          bondLamports: 100000000,
        },
        {
          id: "2",
          proposalPubkey: "Prop222222222222222222222222222222222222222",
          creator: "4xZ9mL2qK1Z2MrF4tH9sPqN6B8aV3eW5xL0mJ4kL9",
          question: "Will SpaceX land Starship on Mars before 2028?",
          description: "Resolves YES upon confirmed Starship landing on Mars surface.",
          category: "Tech",
          createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
          status: "pending",
          bondLamports: 100000000,
        },
      ];
      return ok({
        ok: true,
        markets: allMarkets,
        proposals: mockProposals,
      });
    }
    const rows = await db
      .select()
      .from(marketProposals)
      .orderBy(desc(marketProposals.createdAt));
    const proposals = rows.map((r) => {
      const match = r.description?.match(/\[OUTCOMES:\s*"(.*?)"\s*vs\s*"(.*?)"\]/i);
      return {
        id: String(r.id),
        proposalPubkey: r.proposalPubkey,
        creator: r.proposer,
        question: r.question,
        description: r.description,
        category: r.category,
        createdAt: r.createdAt?.toISOString?.() ?? new Date().toISOString(),
        status: r.status,
        bondLamports: r.bondLamports,
        outcome1: match ? match[1] : "YES",
        outcome2: match ? match[2] : "NO",
      };
    });

    const allMarkets = await getAllMarkets({ limit: 100 });

    return ok({
      ok: true,
      markets: allMarkets,
      proposals,
    });
  } catch (err) {
    return serverError(err);
  }
});

// Aligns with ProposalsSection UI (PATCH { id, action: 'approve' | 'reject' })
export const PATCH = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { id, action, approvedMarketPubkey } = body;
  if (!id || !action) return badRequest("id and action required");
  if (!db) {
    return ok({ ok: true, action, id });
  }

  // Always attribute approve/reject to the guard-verified identity, never a
  // client-supplied `reviewer` field — otherwise any caller who passes the
  // admin guard could attribute the decision to an arbitrary wallet string,
  // defeating accountability for proposal approvals/rejections.
  const reviewer = guard.identity.wallet;

  try {
    if (action === "approve") {
      const [proposal] = await db
        .select()
        .from(marketProposals)
        .where(eq(marketProposals.id, Number(id)))
        .limit(1);

      let finalMarketPubkey = approvedMarketPubkey || null;

      if (proposal && !finalMarketPubkey) {
        // Extract outcome labels from body or proposal description
        let o1 = body.outcome1;
        let o2 = body.outcome2;
        if (!o1 || !o2) {
          const match = proposal.description?.match(
            /\[OUTCOMES: "(.*?)" vs "(.*?)"\]/
          );
          if (match) {
            o1 = o1 || match[1];
            o2 = o2 || match[2];
          }
        }

        const newMarket = await createMarketInDb({
          question: proposal.question,
          description:
            proposal.description
              ?.replace(/\[OUTCOMES: ".*?" vs ".*?"\]/, "")
              .trim() || "",
          category: proposal.category || "Crypto",
          endTs:
            proposal.endTs || new Date(Date.now() + 7 * 24 * 3600 * 1000),
          resolveTs: proposal.resolveTs || undefined,
          outcomes: [o1 || "YES", o2 || "NO"],
        });
        if (newMarket) {
          finalMarketPubkey = newMarket.marketPubkey;
        }
      }

      await db
        .update(marketProposals)
        .set({
          status: "approved",
          approvedMarketPubkey: finalMarketPubkey,
          reviewer,
          reviewedAt: new Date(),
        })
        .where(eq(marketProposals.id, Number(id)));
      await logAuditEntry(
        "PROPOSAL_APPROVE",
        reviewer,
        String(id),
        { approvedMarketPubkey: finalMarketPubkey },
        getClientIp(req)
      ).catch(() => {});
      return ok({ ok: true, action: "approve", id, approvedMarketPubkey: finalMarketPubkey });
    }
    if (action === "reject") {
      await db
        .update(marketProposals)
        .set({
          status: "rejected",
          reviewer,
          reviewedAt: new Date(),
        })
        .where(eq(marketProposals.id, Number(id)));
      await logAuditEntry(
        "PROPOSAL_REJECT",
        reviewer,
        String(id),
        {},
        getClientIp(req)
      ).catch(() => {});
      return ok({ ok: true, action: "reject", id });
    }
    return badRequest("Invalid action (use approve or reject)");
  } catch (err) {
    return serverError(err);
  }
});

export const POST = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { action, marketId, outcome, title, description, category, expiresAt } =
    body;

  try {
    switch (action) {
      case "settle":
        if (!marketId || !outcome)
          return badRequest("marketId and outcome required for settlement");
        await settleMarketInDb(marketId, outcome);
        return ok({ ok: true, action: "settle", marketId, outcome });

      case "cancel":
        if (!marketId) return badRequest("marketId required");
        await settleMarketInDb(marketId, "cancel");
        return ok({ ok: true, action: "cancel", marketId });

      case "create":
        if (!title || !description)
          return badRequest("title and description required");
        const endTs = expiresAt
          ? new Date(expiresAt)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const newMarket = await createMarketInDb({
          question: title,
          description,
          category: category || "Crypto",
          endTs,
        });
        return ok({ ok: true, action: "create", market: newMarket });

      case "approve":
        if (marketId && db) {
          await db
            .update(marketProposals)
            .set({ status: "approved" })
            .where(eq(marketProposals.id, Number(marketId)));
        }
        return ok({ ok: true, action: "approve", marketId });

      case "withdraw_fees":
        if (marketId && db) {
          await db
            .update(marketsCache)
            .set({ updatedAt: new Date() })
            .where(eq(marketsCache.marketId, Number(marketId)));
        }
        return ok({ ok: true, action: "withdraw_fees", marketId });

      default:
        return badRequest("Invalid action parameter");
    }
  } catch (err) {
    return serverError(err);
  }
});
