export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import {
  getWatchlistKeys,
  toggleWatch,
  removeWatch,
} from "@/lib/data/watchlist";
import { badRequest, ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { watchlistGetSchema, watchlistPostSchema } from "@/lib/schemas";

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) return badRequest("Missing wallet parameter");

  const parsed = watchlistGetSchema.safeParse({ wallet });
  if (!parsed.success) return badRequest("Invalid wallet format");

  try {
    const keys = await getWatchlistKeys(parsed.data.wallet);
    return ok({ ok: true, keys });
  } catch (err) {
    console.warn("[Watchlist] Error fetching watchlist, returning empty fallback:", err);
    return ok({ ok: true, keys: [], fallback: true });
  }
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = watchlistPostSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request data");

  try {
    const { wallet, marketPubkey } = parsed.data;
    const isWatched = await toggleWatch(wallet, marketPubkey);
    return ok({ ok: true, action: isWatched ? "added" : "removed", isWatched });
  } catch (err) {
    return serverError(err);
  }
});

// DELETE removes a specific watchlist entry unconditionally (used to purge
// market pubkeys from the DB copy so they don't reappear).
export const DELETE = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = watchlistPostSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request data");

  try {
    const { wallet, marketPubkey } = parsed.data;
    await removeWatch(wallet, marketPubkey);
    return ok({ ok: true, action: "removed", isWatched: false });
  } catch (err) {
    return serverError(err);
  }
});

