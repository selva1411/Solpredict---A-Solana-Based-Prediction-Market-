"use client";
import { useMarkets } from "@/hooks/useMarkets";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  fetchWatchlistFromDb,
  getWatchlist,
  pruneWatchlist,
} from "@/lib/watchlist";
import { signUserProof, userFetch } from "@/lib/user-client";
import {
  formatSol,
  calcYesPct,
  calcNoPct,
  timeUntil,
  categoryName,
  outcomeLabel,
} from "@/lib/format";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Star, ArrowUpRight } from "lucide-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { cn } from "@/lib/utils";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

export default function WatchlistClient({
  initialMarkets,
}: {
  initialMarkets: MarketCacheEntry[];
}) {
  const { markets, loading } = useMarkets(10_000, initialMarkets, {
    status: "all",
  });
  const { publicKey, signMessage } = useWallet();
  const [watchlistKeys, setWatchlistKeys] = useState<string[]>([]);

  useEffect(() => {
    if (publicKey) {
      fetchWatchlistFromDb(publicKey.toBase58(), {
        publicKey,
        signMessage,
      }).then((keys) => setWatchlistKeys(keys));
    } else {
      setWatchlistKeys(getWatchlist());
    }
  }, [publicKey, signMessage]);

  useEffect(() => {
    if (loading || markets.length === 0) return;
    const validKeys = new Set<string>();
    for (const m of markets) {
      validKeys.add(m.publicKey.toBase58());
      validKeys.add(String(m.account.marketId));
    }
    const pruned = pruneWatchlist(validKeys);
    if (pruned.length !== watchlistKeys.length) {
      setWatchlistKeys(pruned);
      if (publicKey) {
        const dead = watchlistKeys.filter((k) => !pruned.includes(k));
        for (const key of dead) {
          void (async () => {
            const auth = await signUserProof(
              { publicKey, signMessage },
              signMessage
            );
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (auth) {
              headers["x-wallet"] = auth.wallet;
              headers["x-message"] = auth.message;
              headers["x-signature"] = auth.signature;
            }
            await userFetch("/api/watchlist", {
              method: "DELETE",
              headers,
              body: JSON.stringify({
                wallet: publicKey.toBase58(),
                marketPubkey: key,
              }),
            }).catch(() => {});
          })();
        }
      }
    }
  }, [loading, markets.length, publicKey, watchlistKeys]);

  const watchedMarkets = markets.filter(
    (m) =>
      watchlistKeys.includes(m.publicKey.toBase58()) ||
      watchlistKeys.includes(String(m.account.marketId))
  );

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-10">
      <div className="mb-8 rise">
        <div className="flex items-center gap-2 mb-2">
          <Star className="w-4 h-4 text-magenta" aria-hidden />
          <h1 className="font-display text-[34px] font-black tracking-tight text-ink">
            Watchlist
          </h1>
        </div>
        <p className="text-[13px] text-ash mt-1">
          {publicKey
            ? `${watchedMarkets.length} tracked market${
                watchedMarkets.length !== 1 ? "s" : ""
              }`
            : "Track markets without connecting a wallet — synced across devices when you connect."}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface h-48 shimmer" />
          ))}
        </div>
      ) : watchedMarkets.length === 0 ? (
        <div className="surface-feature p-14 text-center space-y-5">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full border-2 border-magenta bg-sheet">
            <Star className="w-6 h-6 text-ash-dim" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-[20px] font-extrabold text-ink mb-2">
              Your watchlist is empty
            </h2>
            <p className="text-[13px] text-ash max-w-sm mx-auto">
              Star markets from any card to track their odds, volume and expiry
              here.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/markets"
              className="snap inline-flex items-center gap-2 px-5 h-11 rounded-[4px] bg-ink-fill hover:bg-ink-fill-fill-soft text-white text-[13px] font-semibold transition-colors"
            >
              Browse Markets <ArrowUpRight className="w-4 h-4" />
            </Link>
            {!publicKey && <ClientWalletButton />}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {watchedMarkets.map((m) => {
            const yesPct = Math.round(
              calcYesPct(m.account.yesPoolLamports, m.account.noPoolLamports)
            );
            const settled = m.account.status === 1;
            return (
              <Link
                key={m.publicKey.toBase58()}
                href={`/market/${m.publicKey.toBase58()}`}
                className="block group"
              >
                <div className="surface p-5 flex flex-col gap-3 hover:border-ink transition-colors h-full">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] border border-hairline text-ink">
                      {categoryName(m.account.category)}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-[4px] border-2",
                        m.account.status === 0
                          ? "text-ink border-grass bg-grass/10"
                          : m.account.status === 1
                          ? "text-ink border-inkblue bg-inkblue/10"
                          : "text-ink border-magenta bg-magenta/10"
                      )}
                    >
                      {m.account.status === 0
                        ? "Open"
                        : m.account.status === 1
                        ? "Settled"
                        : "Cancelled"}
                    </span>
                  </div>
                  <p className="text-[14px] font-semibold text-ink group-hover:text-inkblue transition-colors leading-snug line-clamp-2">
                    {m.account.question}
                  </p>
                  {/* Probability bar */}
                  <div
                    className="relative h-1.5 w-full bg-sheet rounded-full overflow-hidden border border-hairline"
                    aria-hidden
                  >
                    <div
                      className="absolute left-0 top-0 h-full bg-yes rounded-full transition-all duration-500"
                      style={{ width: `${yesPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs num font-mono text-ash">
                    <span>
                      YES{" "}
                      <span className="text-ink font-bold bg-yes px-1 rounded-[2px]">
                        {yesPct}%
                      </span>
                    </span>
                    <span>
                      NO{" "}
                      <span className="text-ink font-bold border-2 border-no px-1 rounded-[2px]">
                        {100 - yesPct}%
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between text-xs num font-mono text-ash border-t border-hairline pt-3">
                    <span>
                      Vol{" "}
                      {formatSol(
                        m.account.yesPoolLamports + m.account.noPoolLamports
                      )}{" "}
                      ◎
                    </span>
                    <span>
                      {m.account.status === 0 && timeUntil(m.account.endTs)}
                      {m.account.status === 1 &&
                        (outcomeLabel(m.account.winningOutcome) || "Settled")}
                      {m.account.status === 2 && "Cancelled"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
