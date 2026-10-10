"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

export default function HomePage() {
  const router = useRouter();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? "/overview" : "/login");
  }, [ready, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="flex items-center gap-3 text-[14px] text-text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
        Loading…
      </div>
    </div>
  );
}
