export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getWalletCredit, addWalletCredit, setWalletCredit } from "@/lib/db/wallet-credits-store";
import { creditLocalBalance } from "@/app/api/rpc/route";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet")?.trim() || "";
  if (!wallet) {
    return NextResponse.json({ ok: false, error: "wallet parameter required" }, { status: 400 });
  }
  const credits = getWalletCredit(wallet);
  return NextResponse.json({ ok: true, wallet, credits });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { wallet, deltaLamports, totalCredits } = body;
    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json({ ok: false, error: "wallet address required" }, { status: 400 });
    }

    let updatedCredits = 0;
    if (typeof deltaLamports === "number" && deltaLamports > 0) {
      updatedCredits = addWalletCredit(wallet, deltaLamports);
      creditLocalBalance(wallet, deltaLamports);
    } else if (typeof totalCredits === "number" && totalCredits >= 0) {
      setWalletCredit(wallet, totalCredits);
      updatedCredits = totalCredits;
    } else {
      updatedCredits = getWalletCredit(wallet);
    }

    return NextResponse.json({ ok: true, wallet, credits: updatedCredits });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
