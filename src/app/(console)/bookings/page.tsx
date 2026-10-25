"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { HostedByBadge } from "@/components/ui/HostedBy";
import {
  EmptyState,
  ErrorBanner,
  Skeleton,
} from "@/components/ui/Page";
import { listBookings } from "@/lib/api/bookings";
import {
  EXPERIENCE_CATEGORIES,
  categoryLabel,
  type ExperienceCategory,
} from "@/lib/categories";
import { paymentMethodLabel, statusLabel } from "@/lib/format";
import type { HostedByFilter } from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { bookingFeedKpis } from "@/lib/kpi";
import { mapBookingRow, type BookingRow } from "@/lib/mappers";
import { MOCK_BOOKINGS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

/**
 * `/admin/bookings` returns a capped list (backend take: 100).
 * KPIs and status-tab counts are scoped to that loaded list — not all-time history.
 */

type StatusFilter =
  | "all"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED"
  | "ATTENDED"
  | "NO_SHOW";

type CategoryFilter = "all" | ExperienceCategory;

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "PENDING_PAYMENT", label: "Pending payment" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "ATTENDED", label: "Attended" },
  { id: "NO_SHOW", label: "No-show" },
  { id: "CANCELLED", label: "Cancelled" },
];

function parseStatusParam(raw: string | null): StatusFilter {
  if (
    raw === "PENDING_PAYMENT" ||
    raw === "CONFIRMED" ||
    raw === "CANCELLED" ||
    raw === "ATTENDED" ||
    raw === "NO_SHOW"
  ) {
    return raw;
  }
  return "all";
}

const POLL_MS = 8_000;

function mockBookingRows(): BookingRow[] {
  return MOCK_BOOKINGS.map((b) => ({
    id: b.id,
    guest: b.guest,
    userId: null,
    phone: b.phone,
    email: b.email ?? "—",
    venue: b.venue,
    venueId: b.venueId,
    area: b.area ?? "—",
    when: b.when,
    startsAtIso: null,
    seats: b.seats,
    status: b.status,
    amount: b.amount ?? "—",
    amountValue: null,
    paymentId: b.paymentId ?? null,
    paymentStatus: b.paymentStatus ?? null,
    paymentMethod: null,
    paymentRef: null,
    checkInCode: b.checkInCode ?? null,
    bookingType: null,
    tableType: b.tableType ?? null,
    capacity: b.capacity ?? 6,
    seatsLeft: b.seatsLeft ?? null,
    hostedBy: b.hostedBy,
    cancelReason: null,
    createdAt: null,
    tableId: null,
    experienceName: null,
    menuId: null,
    inclusions: [],
    paymentType: null,
    seatPrice: null,
  }));
}

function statusDot(status: string): string {
  const s = status.toUpperCase();
  if (s === "CONFIRMED" || s === "ATTENDED") return "bg-success";
  if (s === "PENDING_PAYMENT") return "bg-warning";
  if (s === "CANCELLED" || s === "NO_SHOW") return "bg-text-faint";
  return "bg-accent";
}

export default function BookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mockMode } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>(() =>
    parseStatusParam(searchParams.get("status")),
  );
  const [hostedBy, setHostedBy] = useState<HostedByFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [livePulse, setLivePulse] = useState(false);

  useEffect(() => {
    setStatus(parseStatusParam(searchParams.get("status")));
  }, [searchParams]);

  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listBookings(token);
      return res.bookings.map(mapBookingRow);
    },
  );

  useEffect(() => {
    if (mockMode) {
      setSyncedAt(new Date());
      return;
    }
    const tick = () => {
      void reload({ silent: true }).then(() => {
        setSyncedAt(new Date());
        setLivePulse(true);
        window.setTimeout(() => setLivePulse(false), 700);
      });
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [mockMode, reload]);

  useEffect(() => {
    if (data) setSyncedAt(new Date());
  }, [data]);

  /** Full loaded list (capped API feed). KPIs + status tabs use this — not search filters. */
  const rows = useMemo(() => {
    if (mockMode) return mockBookingRows();
    return data ?? [];
  }, [mockMode, data]);

  const pipeline = useMemo(() => bookingFeedKpis(rows), [rows]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const tab of STATUS_TABS) {
      if (tab.id === "all") continue;
      counts[tab.id] = rows.filter((b) => b.status === tab.id).length;
    }
    return counts;
  }, [rows]);

  /** Table rows: loaded list × search × organizing model × category × booking status. */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (hostedBy !== "all" && b.hostedBy !== hostedBy) return false;
      if (category !== "all" && b.tableType !== category) return false;
      if (!needle) return true;
      return [
        b.guest,
        b.phone,
        b.email,
        b.venue,
        b.when,
        b.checkInCode,
        b.amount,
        b.tableType ? categoryLabel(b.tableType) : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, rows, status, hostedBy, category]);

  const kpisReady = mockMode || data != null;
  const syncLabel = syncedAt
    ? syncedAt.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      })
    : "—";

  return (
    <div className="nyto-fade">
      <div className="nyto-bookings-hero relative mb-8 overflow-hidden rounded-[22px] border border-border bg-bg-elevated shadow-[var(--shadow-md)]">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent/15 blur-3xl nyto-drift"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-success/10 blur-3xl nyto-drift-slow"
          aria-hidden
        />
        <div className="relative z-[2] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 nyto-rise">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                Operations
              </p>
              <h1 className="mt-2 font-display text-[34px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[40px]">
                Bookings
              </h1>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-text-muted">
                Guest reservations. Booking status and payment status are
                separate.
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 self-start rounded-full border px-3.5 py-2 text-[11px] font-semibold tracking-[0.06em] transition lg:self-auto ${
                livePulse
                  ? "border-accent/40 bg-[var(--accent-wash)] text-accent-soft"
                  : "border-border bg-bg/60 text-text-faint backdrop-blur"
              }`}
              title="List refreshes every 8 seconds"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  mockMode ? "bg-text-faint" : "bg-accent nyto-live-dot"
                } ${livePulse ? "scale-110" : ""}`}
              />
              {mockMode ? "DEMO" : "Updated"}
              <span className="text-text-faint">·</span>
              <span className="tabular-nums">{syncLabel}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <PulseStat
              label="Bookings in results"
              value={kpisReady ? String(pipeline.totalBookings) : "—"}
              delay={40}
            />
            <PulseStat
              label="Confirmed in results"
              value={kpisReady ? String(pipeline.confirmed) : "—"}
              soft
              delay={80}
            />
            <PulseStat
              label="Cancelled in results"
              value={kpisReady ? String(pipeline.cancelled) : "—"}
              soft
              delay={120}
            />
          </div>
          <p className="mt-3 text-[12px] text-text-faint">
            Counts from the loaded booking list
            {kpisReady ? (
              <>
                {" "}
                ·{" "}
                <span className="tabular-nums text-text-muted">
                  {filtered.length}
                </span>{" "}
                shown after filters
              </>
            ) : null}
          </p>
        </div>
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={() => void reload()} />
      ) : null}

      <div
        className="mb-4 rounded-2xl border border-border bg-bg-elevated/80 p-3 shadow-[var(--shadow-sm)] backdrop-blur-sm sm:p-3.5 nyto-rise"
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 lg:max-w-[300px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search guest, phone, venue, code…"
              aria-label="Search bookings"
            />
          </div>
          <div
            className="flex rounded-xl border border-border bg-bg p-0.5"
            role="group"
            aria-label="Organized by"
          >
            {(
              [
                ["all", "All"],
                ["NYTO", "NYTO-organized"],
                ["PARTNER", "Venue-organized"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setHostedBy(id)}
                className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
                  hostedBy === id
                    ? "bg-bg-soft text-ink"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="mt-3 flex flex-wrap gap-1.5"
          role="group"
          aria-label="Night category"
        >
          <FilterChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="Any type"
          />
          {EXPERIENCE_CATEGORIES.map((c) => (
            <FilterChip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              label={c.label}
              title={c.hint}
            />
          ))}
        </div>

        <div
          className="mt-3 flex flex-wrap gap-1 border-t border-border-subtle pt-3"
          role="tablist"
          aria-label="Booking status"
        >
          {STATUS_TABS.map((tab) => {
            const count = statusCounts[tab.id] ?? 0;
            const on = status === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setStatus(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  on
                    ? "bg-ink text-bg"
                    : "bg-transparent text-text-muted hover:bg-bg-soft hover:text-text"
                }`}
              >
                {tab.label}
                <span
                  className={`tabular-nums ${
                    on ? "text-bg/70" : "text-text-faint"
                  }`}
                >
                  {kpisReady ? count : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && !mockMode && !data ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <Skeleton className="h-[72px] rounded-none" />
          <Skeleton className="h-[72px] rounded-none opacity-70" />
          <Skeleton className="h-[72px] rounded-none opacity-40" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "No bookings yet" : "No matching bookings"}
          description={
            rows.length === 0
              ? "When a guest books a night, it appears here."
              : "Try another search, organizing model, category, or status."
          }
        />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/50 shadow-[var(--shadow-sm)] nyto-rise"
          style={{ animationDelay: "100ms" }}
        >
          <div className="hidden border-b border-border-subtle px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_72px_88px_92px_100px_88px_28px] lg:gap-3">
            <span>Guest</span>
            <span>Night</span>
            <span className="text-right">Booked · cap</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Booking</span>
            <span className="text-right">Payment</span>
            <span className="text-right">Method</span>
            <span />
          </div>
          <ul>
            {filtered.map((b, i) => (
              <li
                key={b.id}
                className="nyto-step-in border-b border-border-subtle last:border-0"
                style={{ animationDelay: `${120 + Math.min(i, 10) * 40}ms` }}
              >
                <BookingRow
                  booking={b}
                  onOpen={() => router.push(`/bookings/${b.id}`)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PulseStat({
  label,
  value,
  soft,
  delay = 0,
}: {
  label: string;
  value: string;
  soft?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={`nyto-bookings-stat nyto-step-in rounded-xl border px-3.5 py-3 ${
        soft
          ? "border-border-subtle bg-bg/40"
          : "border-accent/20 bg-[var(--accent-wash)]"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        {label}
      </p>
      <p className="mt-1 font-display text-[26px] font-medium leading-none tracking-[-0.03em] text-ink">
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "border-accent/40 bg-[var(--accent-wash)] text-accent-soft"
          : "border-border bg-bg text-text-muted hover:border-border hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

function BookingRow({
  booking: b,
  onOpen,
}: {
  booking: BookingRow;
  onOpen: () => void;
}) {
  const contact = b.phone !== "—" ? b.phone : b.email !== "—" ? b.email : null;
  const nightLine = [
    b.when,
    b.tableType ? categoryLabel(b.tableType) : null,
    b.paymentType ? statusLabel(b.paymentType) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="nyto-bookings-row group grid w-full grid-cols-1 gap-2.5 px-4 py-3.5 text-left hover:bg-bg-hover/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_72px_88px_92px_100px_88px_28px] lg:items-center lg:gap-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span
            className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(b.status)}`}
            aria-hidden
          />
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {b.guest}
          </p>
          <HostedByBadge value={b.hostedBy} short />
        </div>
        <p className="mt-1 truncate pl-[18px] text-[12px] leading-none text-text-faint">
          {contact ?? "Contact unavailable"}
          {b.checkInCode ? (
            <span className="font-mono text-text-muted"> · {b.checkInCode}</span>
          ) : null}
        </p>
      </div>

      <div className="min-w-0 pl-[18px] lg:pl-0">
        <p className="truncate text-[13px] font-medium leading-tight text-text">
          {b.venue}
          {b.area && b.area !== "—" ? (
            <span className="font-normal text-text-faint"> · {b.area}</span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[12px] leading-tight text-text-faint">
          {[
            nightLine || null,
            b.experienceName,
            b.inclusions.length > 0 ? b.inclusions.slice(0, 2).join(", ") : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Night unavailable"}
        </p>
      </div>

      <p
        className="pl-[18px] text-[13px] tabular-nums leading-none text-text-muted lg:pl-0 lg:text-right"
        title="Seats on this booking · night capacity when known"
      >
        {b.seats != null ? (
          <>
            <span className="text-ink">{b.seats}</span>
            {b.capacity != null && b.capacity > 0 ? (
              <span className="text-text-faint"> of {b.capacity}</span>
            ) : (
              <span className="text-text-faint">
                {" "}
                seat{b.seats === 1 ? "" : "s"}
              </span>
            )}
          </>
        ) : (
          "—"
        )}
      </p>

      <p
        className="pl-[18px] text-[14px] font-semibold tabular-nums leading-none tracking-[-0.02em] text-ink lg:pl-0 lg:text-right"
        title="Linked payment amount when available"
      >
        {b.amount}
      </p>

      <div className="pl-[18px] lg:flex lg:justify-end lg:pl-0">
        <Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge>
      </div>

      <div className="pl-[18px] lg:flex lg:justify-end lg:pl-0">
        {b.paymentStatus ? (
          <Badge tone={statusTone(b.paymentStatus)}>
            {statusLabel(b.paymentStatus)}
          </Badge>
        ) : (
          <span className="text-[12px] text-text-faint">—</span>
        )}
      </div>

      <p
        className="pl-[18px] text-[12px] leading-tight text-text-muted lg:pl-0 lg:text-right"
        title="Payment method from linked payment record"
      >
        {b.paymentMethod
          ? paymentMethodLabel(b.paymentMethod)
          : b.paymentStatus
            ? "Unknown"
            : "—"}
      </p>

      <span
        className="nyto-bookings-arrow hidden text-[16px] text-text-faint lg:block lg:text-right"
        aria-hidden
      >
        →
      </span>
    </button>
  );
}
