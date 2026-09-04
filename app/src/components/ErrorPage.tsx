"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
}

export function ErrorPage({
  error,
  reset,
  title = "Something went wrong",
  message,
}: ErrorPageProps) {
  logger.error("[ErrorPage]", { digest: error.digest, message: error.message });

  return (
    <div className="bg-cream border border-hairline rounded-[8px] shadow-sm p-8 text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto mt-12">
      <AlertTriangle className="w-12 h-12 text-magenta" />
      <div className="space-y-1">
        <h2 className="text-[21px] font-bold text-ink">{title}</h2>
        <p className="text-[13px] text-ash">
          {error.digest && (
            <span className="block text-[10px] font-mono text-inkblue mb-1">
              Error ID: {error.digest}
            </span>
          )}
          {message || error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-semibold bg-ink-fill hover:bg-ink-fill-fill-soft text-white rounded-[4px] transition-colors snap"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}
