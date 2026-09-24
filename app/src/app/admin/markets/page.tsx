"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Markets management is handled within the main admin panel (/admin).
 * Client-side replace avoids Turbopack/RSC performance.measure negative timestamp issues.
 */
export default function AdminMarketsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin?section=markets");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm font-mono text-[#7F8892]">Redirecting to admin markets...</div>
    </div>
  );
}
