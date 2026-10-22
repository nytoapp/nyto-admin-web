"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
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
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { guestHasBooked, guestListKpis } from "@/lib/kpi";
import { MOCK_GUESTS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Guests = consumer USER accounts from `/admin/guests` (capped list).
 * Classification uses booking-record counts: Has booked (≥1) / Never booked (0).
 */

type GuestFilter = "all" | "has_booked" | "never_booked";

type GuestRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  bookings: number;
  lastVenue: string;
};

function displayPhone(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  return v || "—";
}

function displayEmail(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  return v || "—";
}

export default function GuestsPage() {
  const { mockMode } = useAuth();
  const router = useRouter();
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
          phone: displayPhone(g.phone),
          email: displayEmail(g.email),
          bookings: Number.isFinite(g.bookings) ? g.bookings : 0,
          lastVenue: g.lastVenue?.trim() || "—",
        }),
      );
    },
    [debouncedQ],
  );

  const source = useMemo<GuestRow[]>(() => {
    if (mockMode) {
      const needle = q.trim().toLowerCase();
      return MOCK_GUESTS.filter((g) => {
        if (!needle) return true;
        return [g.name, g.phone, g.email, g.lastVenue]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      }).map((g) => ({
        id: g.id,
        name: g.name,
        phone: displayPhone(g.phone),
        email: displayEmail(g.email),
        bookings: g.bookings,
        lastVenue: g.lastVenue?.trim() || "—",
      }));
    }
    return data ?? [];
  }, [mockMode, q, data]);

  const kpi = useMemo(() => guestListKpis(source), [source]);

  const rows = useMemo(() => {
    if (filter === "has_booked") return source.filter(guestHasBooked);
    if (filter === "never_booked")
      return source.filter((g) => !guestHasBooked(g));
    return source;
  }, [source, filter]);

  const kpisReady = mockMode || data != null;
  const searching = Boolean(debouncedQ);
  const emptyTitle =
    source.length === 0 && !searching && filter === "all"
      ? "No guest accounts yet"
      : searching && source.length === 0
        ? "No guests match your search"
        : "No guests match this filter";
  const emptyDescription =
    source.length === 0 && !searching && filter === "all"
      ? "Consumer accounts appear when people join the NYTO guest app."
      : searching && source.length === 0
        ? "Try another name, phone, or email."
        : "Try another cohort filter.";

  return (
    <div className="nyto-fade">
      <ModuleHero
        eyebrow="Network"
        title="Guests"
        description="Consumer guest-app accounts. Has booked means at least one booking record of any status."
        stats={[
          {
            label: "Guest accounts",
            value: kpisReady ? String(kpi.guestAccounts) : "—",
          },
          {
            label: "Has booked",
            value: kpisReady ? String(kpi.hasBooked) : "—",
            soft: true,
          },
          {
            label: "Never booked",
            value: kpisReady ? String(kpi.neverBooked) : "—",
            soft: true,
          },
        ]}
      />

      {error ? (
        <ErrorBanner message={error} onRetry={() => void reload()} />
      ) : null}

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
        </div>
        <div
          className="mt-3 flex flex-wrap gap-1 border-t border-border-subtle pt-3"
          role="tablist"
          aria-label="Guest cohort"
        >
          <ModulePill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={kpisReady ? kpi.guestAccounts : undefined}
          />
          <ModulePill
            active={filter === "has_booked"}
            onClick={() => setFilter("has_booked")}
            label="Has booked"
            count={kpisReady ? kpi.hasBooked : undefined}
          />
          <ModulePill
            active={filter === "never_booked"}
            onClick={() => setFilter("never_booked")}
            label="Never booked"
            count={kpisReady ? kpi.neverBooked : undefined}
          />
        </div>
        <p className="mt-2.5 text-[12px] text-text-faint">
          Counts from the loaded guest list
          {kpisReady ? (
            <>
              {" "}
              ·{" "}
              <span className="tabular-nums text-text-muted">
                {rows.length}
              </span>{" "}
              shown
            </>
          ) : null}
        </p>
      </ModuleFilters>

      {loading && !mockMode && !data ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <Skeleton className="h-[72px] rounded-none" />
          <Skeleton className="h-[72px] rounded-none opacity-70" />
        </div>
      ) : error && !mockMode && !data ? null : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ModuleFeed
          headers={
            <div className="hidden border-b border-border-subtle px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.35fr)_88px_minmax(0,1.15fr)_120px] md:gap-4">
              <span>Guest</span>
              <span>Contact</span>
              <span className="text-center">Bookings</span>
              <span>Last venue</span>
              <span className="text-right">Status</span>
            </div>
          }
        >
          {rows.map((g, i) => {
            const hasBooked = guestHasBooked(g);
            return (
              <li
                key={g.id}
                className="nyto-step-in border-b border-border-subtle last:border-0"
                style={{ animationDelay: `${120 + Math.min(i, 10) * 40}ms` }}
              >
                <button
                  type="button"
                  onClick={() => router.push(`/guests/${g.id}`)}
                  className="w-full text-left transition hover:bg-bg-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                >
                  <ModuleFeedRow className="md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.35fr)_88px_minmax(0,1.15fr)_120px] md:items-center md:gap-4">
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
                      <p
                        className="inline-flex min-w-[2rem] justify-center rounded-lg bg-bg-soft px-2.5 py-1 text-[13px] font-semibold tabular-nums text-ink"
                        title="Booking records for this guest"
                      >
                        {g.bookings}
                      </p>
                    </div>

                    <p className="min-w-0 truncate text-[13px] font-medium text-text">
                      {hasBooked ? g.lastVenue : "—"}
                    </p>

                    <div className="md:flex md:justify-end">
                      <Badge tone={hasBooked ? "success" : "neutral"}>
                        {hasBooked ? "Has booked" : "Never booked"}
                      </Badge>
                    </div>
                  </ModuleFeedRow>
                </button>
              </li>
            );
          })}
        </ModuleFeed>
      )}
    </div>
  );
}
