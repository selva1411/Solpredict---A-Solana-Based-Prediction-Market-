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
import { useTheme } from "@/contexts/ThemeContext";
import { useSolPrice } from "@/hooks/useSolPrice";
import { keys } from "@/lib/api/keys";
import { signUserProof, userFetch } from "@/lib/user-client";
import { Settings, Star, Bell, Sun, Moon } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";

const NAV_ITEMS = [
  { href: "/markets",    label: "Markets"   },
  { href: "/portfolio",  label: "Portfolio" },
  { href: "/proposals",  label: "Proposals" },
  { href: "/activity",   label: "Activity"  },
  { href: "/leaderboard",label: "Ranks"     },
];

/** Live SOL price chip */
function SolPrice() {
  const { solPrice, loading } = useSolPrice();
  return (
    <div
      className="hidden lg:flex items-center gap-1.5 px-2.5 h-[30px] rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21]"
      title="SOL spot price"
    >
      <span className="font-mono text-[11px] font-semibold text-[#0A0B0D] dark:text-[#EAE8E3] tabular-nums">
        {loading
          ? "—"
          : `$${solPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
      </span>
      <span className="text-[10px] text-[#3A414A] dark:text-[#9AA1AA] font-mono font-medium">SOL</span>
    </div>
  );
}

function ThemeSwitch() {
  const { theme, setTheme, mounted } = useTheme();
  const currentTheme = mounted ? theme : "light";

  return (
    <div
      className="flex items-center rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#1A1D21] p-0.5"
      role="group"
      aria-label="Theme selector"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`flex items-center gap-1.5 px-2 h-[26px] rounded-[2px] text-[11px] font-mono transition-colors cursor-pointer ${
          currentTheme === "light"
            ? "bg-white text-[#0A0B0D] shadow-xs font-semibold"
            : "text-[#22262A] dark:text-[#9AA1AA] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3]"
        }`}
        title="Switch to light theme"
        aria-pressed={currentTheme === "light"}
      >
        <Sun className="w-3 h-3 text-[#A87228] dark:text-[#C49B55]" />
        <span>Light</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`flex items-center gap-1.5 px-2 h-[26px] rounded-[2px] text-[11px] font-mono transition-colors cursor-pointer ${
          currentTheme === "dark"
            ? "bg-[#21252A] text-[#EAE8E3] shadow-xs font-semibold"
            : "text-[#22262A] dark:text-[#9AA1AA] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3]"
        }`}
        title="Switch to dark theme"
        aria-pressed={currentTheme === "dark"}
      >
        <Moon className="w-3 h-3 text-[#1F3A52] dark:text-[#7A9BB5]" />
        <span>Dark</span>
      </button>
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
        className="relative grid place-items-center w-[30px] h-[30px] rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] text-[#22262A] dark:text-[#9AA1AA] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3] hover:border-[#1F3A52] dark:hover:border-[#7A9BB5] transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 bg-[#B43C34] text-white text-[8px] font-bold flex items-center justify-center rounded-full">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21] shadow-lg z-50 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-[#E2DFD7] dark:border-[#2A2F36] flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#22262A] dark:text-[#9AA1AA] font-bold">Notifications</span>
              <span className="text-[10px] text-[#3A414A] dark:text-[#68707B] font-mono">{notifications.length}</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-5 h-5 text-[#3A414A] dark:text-[#68707B] mx-auto mb-2" />
                  <div className="text-[12px] text-[#3A414A] dark:text-[#68707B]">No notifications</div>
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={`px-3.5 py-2.5 border-b border-[#E2DFD7]/60 dark:border-[#2A2F36]/60 last:border-0 transition-colors hover:bg-[#F8F7F4] dark:hover:bg-[#21252A] text-[12px] ${
                      !n.read ? "border-l-2 border-l-[#1F3A52] dark:border-l-[#7A9BB5] pl-3" : ""
                    }`}
                  >
                    <div className="text-[#0A0B0D] dark:text-[#EAE8E3] leading-snug">{n.message}</div>
                    <div className="text-[10px] text-[#3A414A] dark:text-[#68707B] mt-0.5 font-mono">
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
    <header className="fixed top-0 inset-x-0 z-50 bg-[#FFFFFF]/95 dark:bg-[#131518]/95 backdrop-blur-md border-b border-[#E2DFD7] dark:border-[#2A2F36]">
      <div className="mx-auto max-w-[1440px] flex items-center justify-between h-[52px] px-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            {/* SP mark — understated editorial square badge */}
            <div className="w-[28px] h-[28px] flex items-center justify-center bg-[#1F3A52] text-white rounded-[3px] border border-[#1F3A52] group-hover:bg-[#16293B] transition-colors">
              <span className="font-mono text-[11px] font-bold leading-none tracking-tight">
                SP
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 hidden sm:flex">
              <span
                className="font-bold text-[14px] tracking-tight text-[#0A0B0D] dark:text-[#EAE8E3]"
                style={{ fontFamily: "var(--font-syne)", letterSpacing: "-0.01em" }}
              >
                SOLPREDICT
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#3A414A] dark:text-[#9AA1AA] font-semibold">
                Exchange
              </span>
            </div>
          </Link>

          {/* Primary nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-1 rounded-[3px] text-[12px] font-medium transition-colors ${
                    active
                      ? "text-[#0A0B0D] dark:text-[#EAE8E3] bg-[#EAE8E3]/70 dark:bg-[#21252A] font-semibold"
                      : "text-[#22262A] dark:text-[#9AA1AA] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3] hover:bg-[#F1EFEA] dark:hover:bg-[#1A1D21]"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/watchlist"
              aria-current={isActive("/watchlist") ? "page" : undefined}
              className={`px-3 py-1 rounded-[3px] text-[12px] font-medium transition-colors inline-flex items-center gap-1.5 ${
                isActive("/watchlist")
                  ? "text-[#0A0B0D] dark:text-[#EAE8E3] bg-[#EAE8E3]/70 dark:bg-[#21252A] font-semibold"
                  : "text-[#22262A] dark:text-[#9AA1AA] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3] hover:bg-[#F1EFEA] dark:hover:bg-[#1A1D21]"
              }`}
            >
              <Star className="w-3.5 h-3.5 text-[#3A414A] dark:text-[#9AA1AA]" />
              Watch
              {watchlistCount > 0 && (
                <span className="ml-0.5 font-mono text-[10px] text-[#1F3A52] dark:text-[#7A9BB5] font-semibold">
                  {watchlistCount}
                </span>
              )}
            </Link>
            {role === "admin" && (
              <Link
                href="/admin"
                aria-current={isActive("/admin") ? "page" : undefined}
                className={`relative px-3 py-1 text-[12px] font-medium transition-colors inline-flex items-center gap-1 rounded-[3px] ${
                  isActive("/admin")
                    ? "text-[#0A0B0D] dark:text-[#EAE8E3] bg-[#EAE8E3]/70 dark:bg-[#21252A] font-semibold"
                    : "text-[#22262A] dark:text-[#9AA1AA] hover:text-[#0A0B0D] dark:hover:text-[#EAE8E3]"
                }`}
              >
                <Settings className="w-3 h-3" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <SolPrice />
          <ThemeSwitch />
          <NotificationBell />
          <AirdropSolButton />
          <ClientWalletButton />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
