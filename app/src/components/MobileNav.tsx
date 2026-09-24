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
  Star,
  Gift,
  BookOpen,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/contexts/ThemeContext";

const DRAWER_GROUPS = [
  {
    label: "Exchange",
    items: [
      {
        href: "/markets",
        label: "Markets",
        icon: LayoutGrid,
        color: "text-[#555D65] dark:text-[#9AA1AA]",
      },
      {
        href: "/portfolio",
        label: "Portfolio",
        icon: Briefcase,
        color: "text-[#555D65] dark:text-[#9AA1AA]",
      },
      {
        href: "/proposals",
        label: "Proposals",
        icon: Sparkles,
        color: "text-[#555D65] dark:text-[#9AA1AA]",
      },
      {
        href: "/watchlist",
        label: "Watchlist",
        icon: Star,
        color: "text-[#555D65] dark:text-[#9AA1AA]",
      },
    ],
  },
  {
    label: "Live feeds",
    items: [
      {
        href: "/activity",
        label: "Trade tape",
        icon: Activity,
        color: "text-[#555D65] dark:text-[#9AA1AA]",
      },
      {
        href: "/leaderboard",
        label: "Ranks",
        icon: Trophy,
        color: "text-[#555D65] dark:text-[#9AA1AA]",
      },
      {
        href: "/rewards",
        label: "Rewards",
        icon: Gift,
        color: "text-[#555D65] dark:text-[#9AA1AA]",
      },
    ],
  },
  {
    label: "Protocol",
    items: [
      {
        href: "/create",
        label: "Propose market",
        icon: CirclePlus,
        color: "text-[#555D65] dark:text-[#9AA1AA]",
      },
      {
        href: "/docs/getting-started",
        label: "Docs",
        icon: BookOpen,
        color: "text-[#555D65] dark:text-[#9AA1AA]",
      },
    ],
  },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { role } = useUserRole();
  const pathname = usePathname();
  const { theme, setTheme, mounted } = useTheme();
  const currentTheme = mounted ? theme : "light";

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21] hover:bg-[#F1EFEA] dark:hover:bg-[#21252A] text-[#555D65] dark:text-[#9AA1AA] transition-colors cursor-pointer"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-[#16181C] border-r border-[#E2DFD7] dark:border-[#2A2F36] z-50 flex flex-col p-5 overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E2DFD7] dark:border-[#2A2F36]">
                <div className="flex items-center gap-2.5">
                  <div className="w-[26px] h-[26px] rounded-[2px] bg-[#1F3A52] flex items-center justify-center font-mono font-bold text-[10px] text-white">
                    SP
                  </div>
                  <span
                    className="text-[13px] font-bold tracking-tight text-[#181A1C] dark:text-[#EAE8E3]"
                    style={{ fontFamily: "var(--font-syne)" }}
                  >
                    SOLPREDICT
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-[2px] text-[#7F8892] hover:text-[#181A1C] dark:hover:text-[#EAE8E3] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation groups */}
              <div className="flex-1 py-4 space-y-5">
                {DRAWER_GROUPS.map((grp) => (
                  <div key={grp.label} className="space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] mb-1.5 px-3 font-semibold">
                      {grp.label}
                    </div>
                    <div className="space-y-0.5">
                      {grp.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-3 px-3 h-9 rounded-[3px] font-sans text-[12px] font-medium transition-colors ${
                              active
                                ? "bg-[#F1EFEA] dark:bg-[#21252A] text-[#181A1C] dark:text-[#EAE8E3] font-semibold border-l-2 border-[#1F3A52] dark:border-[#7A9BB5]"
                                : "text-[#555D65] dark:text-[#9AA1AA] hover:bg-[#F8F7F4] dark:hover:bg-[#21252A] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${active ? "text-[#1F3A52] dark:text-[#7A9BB5]" : item.color}`} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Theme switch with explicit Light and Dark buttons */}
              <div className="pt-4 border-t border-[#E2DFD7] dark:border-[#2A2F36] space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#7F8892] dark:text-[#68707B] px-1 font-semibold">
                  Theme
                </div>
                <div
                  className="grid grid-cols-2 gap-1.5 p-1 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#F1EFEA] dark:bg-[#1A1D21]"
                  role="group"
                  aria-label="Theme selector"
                >
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex items-center justify-center gap-1.5 h-8 rounded-[2px] text-[12px] font-mono transition-colors cursor-pointer ${
                      currentTheme === "light"
                        ? "bg-white text-[#181A1C] shadow-xs font-semibold"
                        : "text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                    }`}
                    aria-pressed={currentTheme === "light"}
                  >
                    <Sun className="w-3.5 h-3.5 text-[#A87228] dark:text-[#C49B55]" />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex items-center justify-center gap-1.5 h-8 rounded-[2px] text-[12px] font-mono transition-colors cursor-pointer ${
                      currentTheme === "dark"
                        ? "bg-[#21252A] text-[#EAE8E3] shadow-xs font-semibold"
                        : "text-[#555D65] dark:text-[#9AA1AA] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
                    }`}
                    aria-pressed={currentTheme === "dark"}
                  >
                    <Moon className="w-3.5 h-3.5 text-[#1F3A52] dark:text-[#7A9BB5]" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Admin shortcut if authorized */}
              {role === "admin" && (
                <div className="pt-3 border-t border-[#E2DFD7] dark:border-[#2A2F36]">
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 px-3 h-9 rounded-[3px] font-sans text-[12px] text-[#1F3A52] dark:text-[#7A9BB5] hover:bg-[#F1EFEA] dark:hover:bg-[#21252A]"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Admin terminal</span>
                  </Link>
                </div>
              )}
            </motion.aside>
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
 * Mobile bottom rail — compact editorial layout.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  const tabs = [
    {
      href: "/markets",
      label: "Markets",
      icon: BOTTOM_ICONS.markets,
    },
    {
      href: "/activity",
      label: "Tape",
      icon: BOTTOM_ICONS.activity,
    },
    {
      href: "/create",
      label: "Propose",
      icon: BOTTOM_ICONS.create,
    },
    {
      href: "/portfolio",
      label: "Holdings",
      icon: BOTTOM_ICONS.portfolio,
    },
    {
      href: "/leaderboard",
      label: "Ranks",
      icon: Trophy,
    },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#131518]/95 backdrop-blur-md border-t border-[#E2DFD7] dark:border-[#2A2F36] pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 items-stretch h-12">
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors duration-100 ${
              isActive(href)
                ? "text-[#1F3A52] dark:text-[#7A9BB5]"
                : "text-[#7F8892] dark:text-[#68707B] hover:text-[#181A1C] dark:hover:text-[#EAE8E3]"
            }`}
          >
            <Icon
              className="w-4 h-4"
              strokeWidth={isActive(href) ? 2.2 : 1.7}
            />
            <span className="font-sans text-[9px] font-medium">
              {label}
            </span>
            {isActive(href) && (
              <motion.span
                layoutId="mobile-nav-active"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-[#1F3A52] dark:bg-[#7A9BB5] rounded-full"
              />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
