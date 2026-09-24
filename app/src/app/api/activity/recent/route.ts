export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { serverError, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { getRecentActivity } from "@/lib/data/trades";

export const GET = apiHandler(
  async (req: NextRequest) => {
    try {
      const wallet = req.nextUrl.searchParams.get("wallet")?.trim() ?? null;
      const marketPubkey =
        req.nextUrl.searchParams.get("marketPubkey")?.trim() ||
        req.nextUrl.searchParams.get("market")?.trim() ||
        null;
      const limit = Math.min(
        Number(req.nextUrl.searchParams.get("limit") || "50"),
        200
      );

      const activities = await getRecentActivity(wallet, limit, marketPubkey);
      return ok({ ok: true, activities });
    } catch (err) {
      console.warn("[Activity] Transient error fetching recent activity, returning fallback:", err);
      return ok({ ok: true, activities: [], fallback: true });
    }
  },
  { cacheMaxAge: 15, cacheTags: ["activity"] }
);
