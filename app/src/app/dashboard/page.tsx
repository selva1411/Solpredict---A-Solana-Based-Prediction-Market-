"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Dashboard was consolidated into /portfolio.
 * Client-side redirect avoids Turbopack/React Server Component
 * performance.measure negative timestamp issues.
 */
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/portfolio");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm font-mono text-[#7F8892]">Redirecting to portfolio...</div>
    </div>
  );
}
