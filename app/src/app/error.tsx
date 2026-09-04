"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-ground flex items-center justify-center p-4">
      <div className="surface rounded-[8px] p-8 text-center flex flex-col items-center justify-center space-y-4 max-w-md">
        <AlertTriangle className="w-12 h-12 text-no" />
        <div className="space-y-1">
          <h2 className="text-[21px] font-bold text-ink">Application Error</h2>
          <p className="text-[13px] text-ash">
            {error.digest && (
              <span className="block text-[10px] font-mono text-magenta mb-1">
                Error ID: {error.digest}
              </span>
            )}
            {error.message || "An unexpected error occurred. Please try again."}
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
    </div>
  );
}
