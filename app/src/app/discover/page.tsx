"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /discover — redirects to /portfolio per updated platform architecture.
 * Client-side replace avoids Turbopack/RSC performance.measure negative timestamp issues.
 */
export default function DiscoverPage() {
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
