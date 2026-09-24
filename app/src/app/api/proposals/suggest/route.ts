export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { marketProposals } from "@/lib/db/schema";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";
import { normalizeOracleFeedId } from "@/lib/pyth-feeds";

/**
 * POST /api/proposals/suggest
 *
 * Allows regular users to propose/suggest upcoming markets with custom outcome labels
 * and explicit oracle / target pricing configuration for Crypto markets.
 * Proposals enter the admin review queue with status 'pending'.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return badRequest("Invalid JSON body");
  }

  const {
    question: rawQuestion,
    title: rawTitle,
    description,
    category = "Crypto",
    outcome1 = "YES",
    outcome2 = "NO",
    endDate,
    settleDelayHours = 24,
    oracleFeedId,
    targetPrice,
    targetExpo = -8,
    comparison = 0, // 0 = GreaterThan, 1 = LessThan
    sharePriceLamports = 10_000_000, // 0.01 SOL default
    proposer,
  } = body;

  const targetQuestion = (rawQuestion || rawTitle || "").trim();

  if (!targetQuestion || typeof targetQuestion !== "string" || targetQuestion.length < 8) {
    return badRequest("Market question must be at least 8 characters long");
  }

  const cleanOutcome1 = String(outcome1 || "YES").trim().slice(0, 50) || "YES";
  const cleanOutcome2 = String(outcome2 || "NO").trim().slice(0, 50) || "NO";

  if (cleanOutcome1.toLowerCase() === cleanOutcome2.toLowerCase()) {
    return badRequest("Outcome 1 and Outcome 2 must be different");
  }

  const isCrypto = category.trim().toLowerCase() === "crypto";
  let normalizedFeedId: string | null = null;
  let parsedTargetPrice: string | null = null;

  if (isCrypto) {
    normalizedFeedId = normalizeOracleFeedId(oracleFeedId);
    if (!normalizedFeedId || normalizedFeedId === "0".repeat(64)) {
      return badRequest(
        "Crypto markets require a valid 64-character Pyth oracle feed ID"
      );
    }

    const priceNum = parseFloat(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      return badRequest("Crypto markets require a positive target price");
    }
    parsedTargetPrice = priceNum.toString();
  } else {
    normalizedFeedId = oracleFeedId ? normalizeOracleFeedId(oracleFeedId) : "0".repeat(64);
    if (targetPrice && !isNaN(parseFloat(targetPrice))) {
      parsedTargetPrice = parseFloat(targetPrice).toString();
    }
  }

  const randomSuffix = randomUUID().replace(/-/g, "").slice(0, 32);
  const proposerWallet =
    typeof proposer === "string" && proposer.trim().length >= 32
      ? proposer.trim()
      : req.headers.get("x-wallet")?.trim() || `User_${randomSuffix.slice(0, 24)}`;

  const endTimestamp = endDate
    ? new Date(endDate)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const delayMs = Math.max(1, Number(settleDelayHours) || 24) * 60 * 60 * 1000;
  const resolveTimestamp = new Date(endTimestamp.getTime() + delayMs);

  // Pack metadata tags within description for transparent admin preview
  const metaTags = [
    `[OUTCOMES: "${cleanOutcome1}" vs "${cleanOutcome2}"]`,
    isCrypto
      ? `[ORACLE: feed="0x${normalizedFeedId}" target=${parsedTargetPrice} expo=${targetExpo} comp=${Number(comparison) === 1 ? "LessThan" : "GreaterThan"} sharePriceLamports=${sharePriceLamports}]`
      : `[MANUAL_SETTLE: sharePriceLamports=${sharePriceLamports}]`,
  ].join("\n");

  const enrichedDescription = `${description ? description.trim() + "\n\n" : ""}${metaTags}`;

  const proposalPubkey = `Prop_${randomSuffix}`;

  try {
    const db = assertDb();
    const [inserted] = await db
      .insert(marketProposals)
      .values({
        proposalPubkey,
        proposer: proposerWallet,
        question: targetQuestion,
        description: enrichedDescription,
        category: category.trim(),
        oracleFeedId: normalizedFeedId,
        targetPrice: parsedTargetPrice,
        endTs: endTimestamp,
        resolveTs: resolveTimestamp,
        bondLamports: 0,
        status: "pending",
      })
      .returning();

    return ok(
      {
        ok: true,
        proposal: {
          ...inserted,
          outcome1: cleanOutcome1,
          outcome2: cleanOutcome2,
          oracleFeedId: normalizedFeedId,
          targetPrice: parsedTargetPrice,
        },
        message: "Market suggestion submitted successfully! It is now pending admin approval.",
      },
      { status: 201 }
    );
  } catch (err) {
    return serverError(err);
  }
});
