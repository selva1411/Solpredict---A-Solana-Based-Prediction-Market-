"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Settings,
  LayoutGrid,
  Activity,
  CirclePlus,
  Briefcase,
  Trophy,
  Compass,
  Star,
  Gift,
  BookOpen,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const DRAWER_GROUPS = [
  {
    label: "Trade",
    items: [
      {
        href: "/markets",
        label: "Markets",
        icon: LayoutGrid,
        block: "bg-cyan",
      },
      {
        href: "/discover",
        label: "Discover",
        icon: Compass,
        block: "bg-yellow",
      },
      { href: "/watchlist", label: "Watchlist", icon: Star, block: "bg-grass" },
    ],
  },
  {
    label: "Your activity",
    items: [
      {
        href: "/portfolio",
        label: "Portfolio",
        icon: Briefcase,
        block: "bg-ink-fill text-white",
      },
      {
        href: "/activity",
        label: "Activity",
        icon: Activity,
        block: "bg-magenta",
      },
      { href: "/leaderboard", label: "Ranks", icon: Trophy, block: "bg-grass" },
      { href: "/rewards", label: "Rewards", icon: Gift, block: "bg-yellow" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/create", label: "Propose", icon: CirclePlus, block: "bg-cyan" },
      {
        href: "/docs/getting-started",
        label: "Docs",
        icon: BookOpen,
        block: "bg-ink",
      },
    ],
  },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { role } = useUserRole();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-[4px] border border-hairline bg-cream hover:bg-sheet transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-ink" />
        ) : (
          <Menu className="w-5 h-5 text-ink" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/40"
              onClick={() => setIsOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: "100%", opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              className="fixed top-14 right-0 bottom-0 z-40 w-[300px] max-w-[85vw] overflow-y-auto border-l-2 border-ink bg-cream px-4 py-6"
            >
              <div className="space-y-6">
                {DRAWER_GROUPS.map((group) => (
                  <nav key={group.label} aria-label={group.label}>
                    <div className="label-lux mb-2 px-1">{group.label}</div>
                    <ul className="space-y-1">
                      {group.items.map(({ href, label, icon: Icon, block }) => {
                        const active = isActive(href);
                        return (
                          <li key={href}>
                            <Link
                              href={href}
                              onClick={() => setIsOpen(false)}
                              aria-current={active ? "page" : undefined}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-[13px] font-semibold transition-all ${
                                active
                                  ? `${block} snap`
                                  : "text-ink hover:bg-sheet border border-transparent hover:border-hairline"
                              }`}
                            >
                              <Icon
                                className="w-4 h-4 shrink-0"
                                strokeWidth={2}
                              />
                              {label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                ))}

                {role === "admin" && (
                  <nav aria-label="Admin">
                    <div className="label-lux mb-2 px-1">Admin</div>
                    <Link
                      href="/admin"
                      onClick={() => setIsOpen(false)}
                      aria-current={isActive("/admin") ? "page" : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-[13px] font-semibold transition-all ${
                        isActive("/admin")
                          ? "bg-ink-fill text-white snap"
                          : "text-ink hover:bg-sheet border border-transparent hover:border-hairline"
                      }`}
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      Admin
                    </Link>
                  </nav>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const BOTTOM_ICONS = {
  markets: LayoutGrid,
  activity: Activity,
  create: CirclePlus,
  portfolio: Briefcase,
} as const;

/**
 * The single mobile bottom rail (rendered once from the root layout).
 * Profile lives inside Portfolio — a wallet-scoped route (/profile/[wallet])
 * cannot be linked without knowing the key up front.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  const tabs = [
    {
      href: "/markets",
      label: "Markets",
      icon: BOTTOM_ICONS.markets,
      gold: "bg-cyan",
    },
    {
      href: "/activity",
      label: "Tape",
      icon: BOTTOM_ICONS.activity,
      gold: "bg-magenta",
    },
    {
      href: "/create",
      label: "Propose",
      icon: BOTTOM_ICONS.create,
      gold: "bg-yellow",
    },
    {
      href: "/portfolio",
      label: "Holdings",
      icon: BOTTOM_ICONS.portfolio,
      gold: "bg-grass",
    },
    { href: "/leaderboard", label: "Ranks", icon: Trophy, gold: "bg-ink" },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-cream border-t-2 border-ink pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 items-stretch h-16">
        {tabs.map(({ href, label, icon: Icon, gold }) => (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-col items-center justify-center gap-1 transition-colors duration-150 ${
              isActive(href) ? "text-ink" : "text-ash hover:text-ink"
            }`}
          >
            <Icon
              className="w-[18px] h-[18px]"
              strokeWidth={isActive(href) ? 2.4 : 1.9}
            />
            <span className="num font-mono text-[9px] font-bold uppercase tracking-[.12em]">
              {label}
            </span>
            {isActive(href) && (
              <motion.span
                layoutId="mobile-nav-active"
                className={`absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] ${gold}`}
              />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
