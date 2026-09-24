"use client";

import React from "react";
import { HelpCircle, AlertTriangle, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function MarketCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[6px] p-4 flex flex-col gap-3 h-64 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-16 h-3 bg-[#F1EFEA] dark:bg-[#21252A] rounded-[2px]" />
        <div className="w-12 h-3 bg-[#F1EFEA] dark:bg-[#21252A] rounded-[2px]" />
      </div>
      <div className="space-y-2">
        <div className="w-full h-4 bg-[#F1EFEA] dark:bg-[#21252A] rounded-[2px]" />
        <div className="w-3/4 h-4 bg-[#F1EFEA] dark:bg-[#21252A] rounded-[2px]" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-20 h-6 bg-[#F1EFEA] dark:bg-[#21252A] rounded-[3px]" />
        <div className="w-20 h-6 bg-[#F1EFEA] dark:bg-[#21252A] rounded-[2px]" />
      </div>
      <div className="pt-2 mt-auto border-t border-[#E2DFD7] dark:border-[#2A2F36] flex items-center justify-between">
        <div className="w-16 h-3 bg-[#F1EFEA] dark:bg-[#21252A] rounded-[2px]" />
        <div className="w-12 h-3 bg-[#F1EFEA] dark:bg-[#21252A] rounded-[2px]" />
      </div>
    </div>
  );
}

export function LoadingState({ title = "Loading..." }: { title?: string }) {
  return (
    <div className="space-y-3 py-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1D7C59]" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#7F8892] dark:text-[#68707B]">
          {title}
        </span>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-[#1A1D21] border border-[#E2DFD7] dark:border-[#2A2F36] rounded-[3px] animate-pulse" style={{ height: "72px" }} />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({
  icon: Icon = HelpCircle,
  title = "Nothing here",
  description,
  message,
  action,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  message?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="py-16 text-center">
      <Icon className="w-8 h-8 text-[#7F8892] dark:text-[#68707B] mx-auto mb-3" />
      <h2 className="font-sans text-[17px] font-bold text-[#181A1C] dark:text-[#EAE8E3] mb-1.5">
        {title}
      </h2>
      <p className="text-[12px] text-[#555D65] dark:text-[#9AA1AA] max-w-sm mx-auto leading-relaxed">
        {message || description}
      </p>
      {action && (
        <div className="pt-4">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium bg-[#1F3A52] hover:bg-[#16293B] text-white rounded-[3px] transition-colors"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium bg-[#1F3A52] hover:bg-[#16293B] text-white rounded-[3px] transition-colors cursor-pointer"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-white dark:bg-[#1A1D21] p-8 text-center flex flex-col items-center gap-3">
      <AlertTriangle className="w-7 h-7 text-[#B43C34]" />
      <div>
        <h3 className="text-[14px] font-semibold text-[#181A1C] dark:text-[#EAE8E3]">
          Something went wrong
        </h3>
        <p className="text-[12px] text-[#555D65] dark:text-[#9AA1AA] mt-1 max-w-sm">
          {message || "Failed to load data from the network."}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium bg-[#F1EFEA] dark:bg-[#21252A] border border-[#E2DFD7] dark:border-[#2A2F36] hover:border-[#1F3A52] text-[#181A1C] dark:text-[#EAE8E3] rounded-[3px] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

interface LiveIndicatorProps {
  isLive?: boolean;
  label?: string;
}

export function LiveIndicator({ isLive = true, label }: LiveIndicatorProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-medium uppercase tracking-wider ${
        isLive ? "text-[#181A1C] dark:text-[#EAE8E3]" : "text-[#7F8892] dark:text-[#68707B]"
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          isLive ? "bg-[#1D7C59]" : "bg-[#7F8892] dark:bg-[#68707B]"
        }`}
      />
      {label || (isLive ? "Live" : "Offline")}
    </span>
  );
}
