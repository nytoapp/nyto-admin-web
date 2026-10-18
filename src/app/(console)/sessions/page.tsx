"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Sessions merged into venue Experiences — keep route for old bookmarks. */
export default function SessionsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/venues");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-[14px] text-text-muted">
      Nights now live under Venues → Experiences…
    </div>
  );
}
