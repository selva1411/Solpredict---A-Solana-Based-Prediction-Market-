"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { AirdropSolButton } from "@/components/AirdropSolButton";
import { useAppState } from "@/contexts/AppContext";
import { useSolPrice } from "@/hooks/useSolPrice";
import { keys } from "@/lib/api/keys";
import { signUserProof, userFetch } from "@/lib/user-client";
import { Settings, Star, Sun, Moon } from "lucide-react";

import { Logo3D } from "@/components/Logo3D";
import { MobileNav } from "@/components/MobileNav";
import { useTheme } from "@/contexts/ThemeContext";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets", block: "bg-cyan text-ink-static" },
  { href: "/discover", label: "Discover", block: "bg-yellow text-ink-static" },
  {
    href: "/activity",
    label: "Activity",
    block: "bg-magenta text-white dark:text-ink-static",
  },
  { href: "/leaderboard", label: "Ranks", block: "bg-grass text-ink-static" },
];

/** Light/Dark theme switcher. */
function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useTheme();
  const isDark = mounted && theme === "dark";
  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="grid place-items-center w-8 h-8 rounded-[4px] border border-hairline bg-cream text-ash hover:text-ink hover:border-ink transition-colors duration-150 cursor-pointer"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

/** Live SOL price as a hard ink mono chip. */
function SolPrice() {
  const { solPrice, loading } = useSolPrice();
  return (
    <div
      className="hidden lg:flex items-center gap-2 px-3 h-8 rounded-[4px] border-2 border-ink bg-cream"
      title="SOL spot price"
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ash">
        SOL
      </span>
      <span className="num font-mono text-[13px] font-bold text-ink">
        {loading
          ? "—"
          : `$${solPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
      </span>
    </div>
  );
}

function NotificationBell() {
  const { publicKey, signMessage } = useWallet();
  const [open, setOpen] = useState(false);

  const walletStr = publicKey?.toBase58() ?? null;

  const { data: notifications = [] } = useQuery({
    queryKey: keys.user.notifications(walletStr ?? "none"),
    queryFn: async () => {
      const auth = await signUserProof({ publicKey, signMessage }, signMessage);
      const headers: Record<string, string> = {};
      if (auth) {
        headers["x-wallet"] = auth.wallet;
        headers["x-message"] = auth.message;
        headers["x-signature"] = auth.signature;
      }
      const r = await userFetch(`/api/user/notifications?wallet=${walletStr}`, {
        headers,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return (data.notifications ?? []) as Array<{
        id: string;
        type: string;
        message: string;
        read: boolean;
        createdAt: string;
      }>;
    },
    enabled: !!walletStr,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const unread = notifications.filter((n) => !n.read).length;

  if (!publicKey) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-[4px] border border-hairline bg-cream hover:bg-sheet transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <svg
          className="w-4 h-4 text-ink"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-magenta text-white dark:text-ink-static text-[9px] font-bold flex items-center justify-center rounded">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 dropdown-panel z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-hairline flex items-center justify-between bg-sheet/50">
              <span className="label-lux">Notifications</span>
              <span className="text-[10px] text-ash num">
                {notifications.length} total
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-sheet flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-ash"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden
                    >
                      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                    </svg>
                  </div>
                  <div className="text-[13px] font-medium text-ash">
                    No notifications yet
                  </div>
                  <div className="text-[11px] text-ash-dim mt-1">
                    You&apos;ll see updates here
                  </div>
                </div>
              ) : (
                notifications.slice(0, 20).map((n, i) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-hairline/50 last:border-0 transition-colors hover:bg-sheet/40 ${
                      !n.read
                        ? "bg-magenta/[0.04] border-l-[3px] border-l-magenta"
                        : ""
                    }`}
                  >
                    <div className="text-[13px] text-ink font-medium leading-snug">
                      {n.message}
                    </div>
                    <div className="text-[10px] text-ash mt-1 num">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Navigation() {
  const { role } = useUserRole();
  const pathname = usePathname();
  const { watchlist } = useAppState();
  const watchlistCount = watchlist.length;

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-cream border-b-2 border-ink shadow-panel">
      {/* CMYK signal bar — brand force, flat vector */}
      <div className="h-1 w-full flex">
        <span className="flex-1 bg-cyan" />
        <span className="flex-1 bg-magenta" />
        <span className="flex-1 bg-yellow" />
        <span className="flex-1 bg-grass" />
      </div>
      <div className="mx-auto max-w-[1240px] flex items-center justify-between h-14 px-4 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 flex items-center justify-center rounded-[4px] bg-ink-fill text-white">
              <Logo3D />
            </div>
            <span className="font-display font-extrabold text-[16px] tracking-tight text-ink">
              SOL<span className="text-magenta">PREDICT</span>
            </span>
          </Link>

          <nav
            className="hidden lg:flex items-center gap-0.5"
            aria-label="Primary"
          >
            {NAV_ITEMS.map(({ href, label, block }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`nav-pill ${
                    active ? `${block}` : "text-ink hover:bg-sheet"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/watchlist"
              aria-current={isActive("/watchlist") ? "page" : undefined}
              className={`nav-pill inline-flex items-center gap-1 ${
                isActive("/watchlist")
                  ? "bg-cyan text-ink-static"
                  : "text-ink hover:bg-sheet"
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              Watchlist
              {watchlistCount > 0 && (
                <span className="ml-0.5 num font-mono text-[10px]">
                  {watchlistCount}
                </span>
              )}
            </Link>
            {role === "admin" && (
              <Link
                href="/admin"
                aria-current={isActive("/admin") ? "page" : undefined}
                className={`nav-pill inline-flex items-center gap-1 ${
                  isActive("/admin")
                    ? "bg-ink-fill text-white"
                    : "text-ink hover:bg-sheet"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SolPrice />
          <NotificationBell />
          <AirdropSolButton />
          <ClientWalletButton />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
