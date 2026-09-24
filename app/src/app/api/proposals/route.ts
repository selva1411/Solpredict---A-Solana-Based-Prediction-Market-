export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketProposals } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

/**
 * GET /api/proposals
 *
 * Public endpoint returning all upcoming market proposals suggested by the community.
 */
export const GET = apiHandler(async (_req: NextRequest) => {
  try {
    if (!db) {
      return ok({
        ok: true,
        proposals: [],
        total: 0,
      });
    }

    const rows = await db
      .select()
      .from(marketProposals)
      .orderBy(desc(marketProposals.createdAt));

    const proposals = rows.map((r) => {
      const match = r.description?.match(/\[OUTCOMES:\s*"(.*?)"\s*vs\s*"(.*?)"\]/i);
      const cleanDescription = r.description?.replace(/\[OUTCOMES:\s*".*?"\s*vs\s*".*?"\]/i, "").trim() || "";
      return {
        id: String(r.id),
        proposalPubkey: r.proposalPubkey,
        creator: r.proposer,
        question: r.question,
        description: cleanDescription || r.description,
        category: r.category || "Crypto",
        createdAt: r.createdAt?.toISOString?.() ?? new Date().toISOString(),
        endTs: r.endTs?.toISOString?.() ?? null,
        status: r.status,
        bondLamports: r.bondLamports,
        outcome1: match ? match[1] : "YES",
        outcome2: match ? match[2] : "NO",
      };
    });

    return ok({
      ok: true,
      proposals,
      total: proposals.length,
    });
  } catch (err) {
    console.warn("[Proposals] Transient error fetching proposals, returning fallback:", err);
    return ok({
      ok: true,
      proposals: [],
      total: 0,
      fallback: true,
    });
  }
});
