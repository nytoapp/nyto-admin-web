"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    items: [{ href: "/host-applications", label: "Host applications" }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, ready } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-[13px] text-text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
          Loading console…
        </div>
      </div>
    );
  }

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen text-text">
      <div className="mx-auto flex min-h-screen max-w-[1480px]">
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-border-subtle bg-bg/50 px-3 py-4 backdrop-blur-md md:flex">
          <Link href="/overview" className="mb-7 flex items-center gap-2.5 px-2 pt-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[11px] font-bold tracking-wide text-white shadow-[0_8px_24px_rgba(61,110,255,0.35)]">
              N
            </span>
            <div>
              <div className="text-[13px] font-semibold tracking-[0.16em]">NYTO</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-faint">
                Admin
              </div>
            </div>
          </Link>

          <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">
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
                        className={`rounded-lg px-2.5 py-2 text-[13px] font-medium transition duration-150 ${
                          active
                            ? "bg-accent/15 text-accent-soft shadow-[inset_0_0_0_1px_rgba(61,110,255,0.28)]"
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

          <div className="mt-auto rounded-xl border border-border bg-bg-elevated/85 p-3">
            <p className="truncate text-[12px] font-medium text-text">
              {user.fullName || "NYTO Admin"}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-text-faint">
              {user.email || "Founder"}
            </p>
            <Button
              variant="ghost"
              className="mt-2 h-8 w-full justify-start px-2"
              onClick={() => void logout()}
            >
              Sign out
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/75 backdrop-blur-md md:hidden">
            <div className="flex h-12 items-center gap-3 px-4">
              <Link
                href="/overview"
                className="text-[13px] font-semibold tracking-[0.16em]"
              >
                NYTO
              </Link>
              <div className="ml-auto flex min-w-0 items-center gap-2">
                <span className="max-w-[140px] truncate text-[11px] text-text-faint">
                  {user.email || user.fullName}
                </span>
                <Button variant="ghost" className="h-8 shrink-0" onClick={() => void logout()}>
                  Sign out
                </Button>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto border-t border-border-subtle px-3 py-2">
              {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                      ? "bg-accent/15 text-accent-soft"
                      : "bg-bg-soft text-text-muted"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>

          <main className="nyto-page flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
