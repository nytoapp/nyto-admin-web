"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/Button";

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [{ href: "/overview", label: "Overview" }],
  },
  {
    label: "Operations",
    items: [
      { href: "/venues", label: "Venues" },
      { href: "/sessions", label: "Sessions" },
      { href: "/bookings", label: "Bookings" },
      { href: "/payments", label: "Payments" },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/host-applications", label: "Host applications" },
      { href: "/guests", label: "Guests" },
    ],
  },
  {
    label: "Console",
    items: [
      { href: "/team", label: "Team" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, ready, mockMode } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
  }, [ready, user, router]);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setMobileOpen(false);
    // logout() hard-navigates to /login — no intermediate loading screen.
    await logout();
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex items-center gap-3 text-[14px] text-text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
          Loading console…
        </div>
      </div>
    );
  }

  if (!user) {
    // Brief guard while redirecting unauthenticated users — keep blank, no spinner.
    return <div className="min-h-screen bg-bg" />;
  }

  const nav = (
    <>
      <Link
        href="/overview"
        className="mb-8 flex items-center gap-2.5 px-2.5 pt-1"
        onClick={() => setMobileOpen(false)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(21,94,239,0.35)]">
          N
        </span>
        <div>
          <div className="text-[14px] font-semibold tracking-[0.14em] text-ink">
            NYTO
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
            Admin{mockMode ? " · Mock" : ""}
          </div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-xl px-3 py-2.5 text-[14px] font-medium transition duration-150 ${
                      active
                        ? "bg-[var(--accent-wash)] text-accent shadow-[inset_0_0_0_1px_rgba(21,94,239,0.18)]"
                        : "text-text-muted hover:bg-bg-soft hover:text-text"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-border bg-bg p-3.5">
        <p className="truncate text-[13px] font-semibold text-ink">
          {user.fullName || "NYTO Admin"}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-text-faint">
          {user.email || "Founder"}
        </p>
        <Button
          variant="ghost"
          className="mt-2 h-9 w-full justify-start px-2 text-[14px]"
          disabled={signingOut}
          onClick={() => void onSignOut()}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen text-text">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-border bg-bg-elevated/90 px-3 py-5 backdrop-blur-md lg:flex">
          {nav}
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-[min(288px,86vw)] flex-col border-r border-border bg-bg-elevated px-3 py-5 shadow-lg">
              {nav}
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-bg-elevated/90 backdrop-blur-md lg:hidden">
            <div className="flex h-14 items-center gap-3 px-4">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-elevated text-[18px] text-ink"
                aria-label="Open menu"
              >
                ≡
              </button>
              <Link
                href="/overview"
                className="text-[14px] font-semibold tracking-[0.14em] text-ink"
              >
                NYTO
              </Link>
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  className="h-9 text-[13px]"
                  disabled={signingOut}
                  onClick={() => void onSignOut()}
                >
                  {signingOut ? "…" : "Sign out"}
                </Button>
              </div>
            </div>
          </header>

          <main className="nyto-page flex-1 px-4 py-5 sm:px-6 sm:py-7 md:px-8 md:py-8 lg:px-9">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
