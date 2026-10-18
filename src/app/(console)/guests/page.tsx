"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import {
  ModuleFeed,
  ModuleFeedRow,
  ModuleFilters,
  ModuleHero,
  ModulePill,
} from "@/components/ui/ModuleShell";
import {
  EmptyState,
  ErrorBanner,
  Skeleton,
} from "@/components/ui/Page";
import { listGuests } from "@/lib/api/guests";
import { statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { MOCK_GUESTS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

type GuestFilter = "all" | "ACTIVE" | "NEW";

type GuestRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  bookings: number;
  lastVenue: string;
  status: string;
};

export default function GuestsPage() {
  const { mockMode } = useAuth();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filter, setFilter] = useState<GuestFilter>("all");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listGuests(token, debouncedQ || undefined);
      return res.guests.map(
        (g): GuestRow => ({
          id: g.id,
          name: g.name,
          phone: g.phone || "—",
          email: g.email || "—",
          bookings: g.bookings,
          lastVenue: g.lastVenue || "—",
          status: g.status,
        }),
      );
    },
    [debouncedQ],
  );

  const source: GuestRow[] = mockMode
    ? MOCK_GUESTS.filter((g) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return true;
        return [g.name, g.phone, g.email, g.lastVenue]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
    : (data ?? []);

  const rows = useMemo(() => {
    if (filter === "all") return source;
    return source.filter((g) => g.status === filter);
  }, [source, filter]);

  const bookedCount = source.filter((g) => g.status === "ACTIVE").length;
  const newCount = source.filter((g) => g.status === "NEW").length;
  const bookingSum = source.reduce((s, g) => s + g.bookings, 0);

  return (
    <div className="nyto-fade">
      <ModuleHero
        eyebrow="Network"
        title="Guests"
        description="Guest-app people — who booked, who only signed up, and where they last sat."
        stats={[
          { label: "Guests", value: String(source.length) },
          { label: "Booked", value: String(bookedCount), soft: true },
          { label: "New", value: String(newCount), soft: true },
          { label: "Bookings", value: String(bookingSum), soft: true },
        ]}
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <ModuleFilters>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 lg:max-w-[300px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, email…"
              aria-label="Search guests"
            />
          </div>
          <p className="text-[13px] tabular-nums text-text-faint lg:ml-auto">
            {rows.length}
            <span className="text-text-faint/70"> / {source.length}</span>
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1 border-t border-border-subtle pt-3">
          <ModulePill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={source.length}
          />
          <ModulePill
            active={filter === "ACTIVE"}
            onClick={() => setFilter("ACTIVE")}
            label="Booked"
            count={bookedCount}
            title="At least one booking"
          />
          <ModulePill
            active={filter === "NEW"}
            onClick={() => setFilter("NEW")}
            label="Signed up only"
            count={newCount}
            title="In the app, no booking yet"
          />
        </div>
        <p className="mt-2.5 text-[12px] text-text-faint">
          Active = booked at least once. New = logged into the guest app, no
          booking yet. Venue staff are not listed here.
        </p>
      </ModuleFilters>

      {loading && !mockMode && !data ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <Skeleton className="h-[72px] rounded-none" />
          <Skeleton className="h-[72px] rounded-none opacity-70" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            !mockMode && source.length === 0 && !debouncedQ
              ? "No guests yet"
              : "No guests found"
          }
          description={
            !mockMode && source.length === 0 && !debouncedQ
              ? "Guests appear when people join the NYTO guest app."
              : "Try another search or filter."
          }
        />
      ) : (
        <ModuleFeed
          headers={
            <div className="hidden border-b border-border-subtle px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.35fr)_88px_minmax(0,1.15fr)_104px] md:gap-4">
              <span>Guest</span>
              <span>Contact</span>
              <span className="text-center">Bookings</span>
              <span>Last venue</span>
              <span className="text-right">Status</span>
            </div>
          }
        >
          {rows.map((g, i) => (
            <li
              key={g.id}
              className="nyto-step-in border-b border-border-subtle last:border-0"
              style={{ animationDelay: `${120 + Math.min(i, 10) * 40}ms` }}
            >
              <ModuleFeedRow className="md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.35fr)_88px_minmax(0,1.15fr)_104px] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
                    {g.name}
                  </p>
                  <p className="mt-1 truncate text-[12px] text-text-faint md:hidden">
                    {g.phone !== "—" ? g.phone : g.email}
                  </p>
                </div>

                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-[13px] text-text-muted">
                    {g.phone}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-text-faint">
                    {g.email}
                  </p>
                </div>

                <div className="md:text-center">
                  <p className="inline-flex min-w-[2rem] justify-center rounded-lg bg-bg-soft px-2.5 py-1 text-[13px] font-semibold tabular-nums text-ink">
                    {g.bookings}
                  </p>
                </div>

                <p className="min-w-0 truncate text-[13px] font-medium text-text">
                  {g.lastVenue}
                </p>

                <div className="md:flex md:justify-end">
                  <Badge tone={statusTone(g.status)}>
                    {g.status === "ACTIVE"
                      ? "Booked"
                      : g.status === "NEW"
                        ? "Signed up"
                        : statusLabel(g.status)}
                  </Badge>
                </div>
              </ModuleFeedRow>
            </li>
          ))}
        </ModuleFeed>
      )}
    </div>
  );
}
