"use client";

import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HostedByBadge } from "@/components/ui/HostedBy";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import { listBookings } from "@/lib/api/bookings";
import { listGuests } from "@/lib/api/guests";
import {
  enrichBookingsWithMenus,
  experienceDisplayName,
  type EnrichedBookingRow,
} from "@/lib/booking-experience";
import { categoryLabel } from "@/lib/categories";
import { paymentMethodLabel, statusLabel } from "@/lib/format";
import {
  bookingTiming,
  buildVenueVisitSummaries,
  countByBookingStatus,
  groupGuestBookings,
  loadSharedTableContexts,
  mealPeriodFromStartsAt,
  mealPeriodLabel,
  physicalAttendanceLabel,
  reconnectPreferenceLabel,
  type SharedTableContext,
  type VenueVisitSummary,
} from "@/lib/guest-details";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapBookingRow } from "@/lib/mappers";
import { MOCK_GUESTS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Guest history from existing list APIs only.
 * `/admin/guests` and `/admin/bookings` are both capped (take: 100).
 * There is no admin bookings-by-userId filter — feed history is not lifetime.
 */

const CONTACT_FALLBACK = "Not provided";

type GuestIdentity = {
  id: string;
  name: string;
  phone: string;
  email: string;
  /** Lifetime booking record count from `/admin/guests` `_count.bookings`. */
  guestListBookings: number | null;
  lastVenue: string | null;
};

function contactOrFallback(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v || v === "—") return CONTACT_FALLBACK;
  return v;
}

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const guestId = params.id;
  const router = useRouter();
  const { mockMode } = useAuth();

  const {
    data: guest,
    loading: guestLoading,
    error: guestError,
    reload: reloadGuest,
  } = useAdminResource(
    !mockMode && Boolean(guestId),
    async (token) => {
      const res = await listGuests(token);
      const row = res.guests.find((g) => g.id === guestId);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name?.trim() || "Guest",
        phone: contactOrFallback(row.phone),
        email: contactOrFallback(row.email),
        guestListBookings: Number.isFinite(row.bookings) ? row.bookings : null,
        lastVenue: row.lastVenue?.trim() || null,
      } satisfies GuestIdentity;
    },
    [guestId],
  );

  const {
    data: history,
    loading: historyLoading,
    error: historyError,
    reload: reloadHistory,
  } = useAdminResource(
    !mockMode && Boolean(guestId),
    async (token) => {
      const res = await listBookings(token);
      const mapped = res.bookings
        .filter((b) => b.user?.id === guestId)
        .map(mapBookingRow);
      return enrichBookingsWithMenus(token, mapped);
    },
    [guestId],
  );

  const rows: EnrichedBookingRow[] = useMemo(() => {
    if (mockMode) return [];
    return (history ?? []).map((r) => ({
      ...r,
      menuDescription: r.menuDescription ?? null,
    }));
  }, [mockMode, history]);

  const tableKey = rows
    .map((r) => r.tableId)
    .filter(Boolean)
    .join(",");

  const {
    data: sharedTables,
    loading: sharedLoading,
    error: sharedError,
    reload: reloadShared,
  } = useAdminResource(
    !mockMode && Boolean(guestId) && rows.length > 0 && Boolean(tableKey),
    async (token) => loadSharedTableContexts(token, rows, guestId),
    [guestId, tableKey],
  );

  const mockGuest = useMemo<GuestIdentity | null>(() => {
    if (!mockMode) return null;
    const g = MOCK_GUESTS.find((row) => row.id === guestId);
    if (!g) return null;
    return {
      id: g.id,
      name: g.name,
      phone: contactOrFallback(g.phone),
      email: contactOrFallback(g.email),
      guestListBookings: g.bookings,
      lastVenue: g.lastVenue === "—" ? null : g.lastVenue,
    };
  }, [mockMode, guestId]);

  const identity = mockMode ? mockGuest : guest;
  const guestSettled = mockMode || !guestLoading;
  const historySettled = mockMode || !historyLoading;
  const loading = !mockMode && guestLoading;
  const error = guestError || historyError || sharedError;

  const { upcoming, past, cancelled, unknown } = useMemo(
    () => groupGuestBookings(rows),
    [rows],
  );
  const statusCounts = useMemo(() => countByBookingStatus(rows), [rows]);
  const venueSummaries = useMemo(() => buildVenueVisitSummaries(rows), [rows]);
  /** Past-dated experiences including cancelled — status badges stay distinct. */
  const pastExperiences = useMemo(() => {
    const dated = rows.filter((b) => bookingTiming(b) === "past");
    return [...dated].sort((a, b) => {
      const am = a.startsAtIso ? new Date(a.startsAtIso).getTime() : 0;
      const bm = b.startsAtIso ? new Date(b.startsAtIso).getTime() : 0;
      return bm - am;
    });
  }, [rows]);

  if (loading) {
    return (
      <div className="nyto-fade mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-44 w-full rounded-[22px]" />
        <div className="grid gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (guestSettled && !identity) {
    return (
      <div className="nyto-fade mx-auto max-w-4xl">
        <PageHeader
          title="Guest not found"
          description="This account is not in the loaded guest list (API returns up to 100 consumer accounts)."
          actions={
            <Button variant="secondary" onClick={() => router.push("/guests")}>
              Back to guests
            </Button>
          }
        />
        {error ? (
          <ErrorBanner
            message={error}
            onRetry={() => {
              void reloadGuest();
              void reloadHistory();
            }}
          />
        ) : null}
      </div>
    );
  }

  if (!identity) return null;

  return (
    <div className="nyto-fade mx-auto max-w-4xl">
      <Link
        href="/guests"
        className="inline-flex text-[13px] font-semibold text-text-muted transition hover:text-accent"
      >
        ← Guests
      </Link>

      <header className="nyto-bookings-hero relative mt-5 overflow-hidden rounded-[22px] border border-border bg-bg-elevated shadow-[var(--shadow-md)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_0%_-10%,rgba(77,139,255,0.14),transparent_55%)] opacity-90"
          aria-hidden
        />
        <div className="relative z-[2] px-5 py-6 sm:px-7 sm:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            Guest
          </p>
          <h1 className="mt-2 font-display text-[36px] font-medium leading-[1.05] tracking-[-0.04em] text-ink sm:text-[42px]">
            {identity.name}
          </h1>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                Phone
              </dt>
              <dd className="mt-1 text-[14px] font-medium text-ink">
                {identity.phone}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                Email
              </dt>
              <dd className="mt-1 truncate text-[14px] font-medium text-ink">
                {identity.email}
              </dd>
            </div>
          </dl>

          <p className="mt-5 max-w-2xl border-t border-border-subtle pt-4 text-[12px] text-text-faint">
            History from the loaded bookings feed — not a lifetime ledger.
            {identity.lastVenue ? (
              <>
                {" "}
                Last venue ·{" "}
                <span className="text-text-muted">{identity.lastVenue}</span>
              </>
            ) : null}
          </p>
        </div>
      </header>

      {error ? (
        <div className="mt-4">
          <ErrorBanner
            message={error}
            onRetry={() => {
              void reloadGuest();
              void reloadHistory();
              void reloadShared();
            }}
          />
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="In feed"
          hint="Booking records"
          value={historySettled ? String(rows.length) : "—"}
        />
        <Stat
          label="Guest total"
          hint="From guest list"
          value={
            identity.guestListBookings != null
              ? String(identity.guestListBookings)
              : "—"
          }
        />
        <Stat
          label="Upcoming"
          hint="In feed"
          value={historySettled ? String(upcoming.length) : "—"}
        />
        <Stat
          label="Booking · Attended"
          hint="Status in feed"
          value={historySettled ? String(statusCounts.attended) : "—"}
        />
      </div>

      {/* Booking history */}
      <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
        <div className="border-b border-border-subtle px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Booking history
          </p>
        </div>

        {!historySettled ? (
          <div className="space-y-0 p-0">
            <Skeleton className="h-[72px] rounded-none" />
            <Skeleton className="h-[72px] rounded-none opacity-70" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No bookings found"
            description="No bookings for this guest in the current feed."
          />
        ) : (
          <div>
            {upcoming.length > 0 ? (
              <BookingGroup label="Upcoming" rows={upcoming} />
            ) : null}
            {past.length > 0 ? (
              <BookingGroup label="Past" rows={past} />
            ) : null}
            {cancelled.length > 0 ? (
              <BookingGroup label="Cancelled" rows={cancelled} />
            ) : null}
            {unknown.length > 0 ? (
              <BookingGroup label="Date unknown" rows={unknown} />
            ) : null}
          </div>
        )}
      </section>

      {/* Venue visit history */}
      <SectionCard title="Venue visit history">
        {!historySettled ? (
          <Skeleton className="mx-5 mb-4 h-16 rounded-xl" />
        ) : venueSummaries.length === 0 ? (
          <EmptyState
            title="No venue records found"
            description="No venue bookings in the current feed."
          />
        ) : (
          <ul>
            {venueSummaries.map((v) => (
              <VenueRow key={v.venueId} summary={v} />
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Tables & attendance */}
      <SectionCard title="Dining nights & attendance">
        {!historySettled ? (
          <Skeleton className="mx-5 mb-4 h-16 rounded-xl" />
        ) : rows.filter((r) => r.tableId).length === 0 ? (
          <EmptyState
            title="No dining nights found"
            description="No dining-night links on this guest’s bookings."
          />
        ) : (
          <ul>
            {rows
              .filter((r) => r.tableId)
              .map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-1.5 border-b border-border-subtle px-5 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {experienceDisplayName(r.experienceName)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-muted">
                      {[
                        r.venue !== "—" ? r.venue : null,
                        r.when !== "—" ? r.when : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(r.status)}>
                      Booking · {statusLabel(r.status)}
                    </Badge>
                    <Badge tone="neutral">
                      {physicalAttendanceLabel()}
                    </Badge>
                    <Link
                      href={`/bookings/${r.id}`}
                      className="text-[12px] font-semibold text-accent hover:underline"
                    >
                      Booking
                    </Link>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>

      {/* Past dinners & lunches */}
      <SectionCard title="Past dinners & lunches">
        {!historySettled ? (
          <Skeleton className="mx-5 mb-4 h-16 rounded-xl" />
        ) : pastExperiences.length === 0 ? (
          <EmptyState
            title="No past experiences found"
            description="No past-dated bookings in the current feed."
          />
        ) : (
          <ul>
            {pastExperiences.map((r) => {
              const period = mealPeriodFromStartsAt(r.startsAtIso);
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-1.5 border-b border-border-subtle px-5 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {experienceDisplayName(r.experienceName)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-muted">
                      {[
                        mealPeriodLabel(period),
                        r.venue !== "—" ? r.venue : null,
                        r.when !== "—" ? r.when : null,
                        r.tableType ? categoryLabel(r.tableType) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(r.status)}>
                      Booking · {statusLabel(r.status)}
                    </Badge>
                    {r.paymentStatus ? (
                      <Badge tone={statusTone(r.paymentStatus)}>
                        Payment · {statusLabel(r.paymentStatus)}
                      </Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* People at same tables */}
      <SectionCard title="People at the same table">
        {mockMode ? (
          <p className="px-5 py-4 text-[13px] text-text-faint">Not available</p>
        ) : !historySettled || (sharedLoading && !sharedTables) ? (
          <Skeleton className="mx-5 mb-4 h-16 rounded-xl" />
        ) : !tableKey ? (
          <EmptyState
            title="No table bookings found"
            description="No dining-night links available for this guest."
          />
        ) : (sharedTables ?? []).length === 0 ? (
          <EmptyState
            title="No shared-table data"
            description="Could not load bookings for these dining nights."
          />
        ) : (
          <ul>
            {(sharedTables as SharedTableContext[]).map((t) => (
              <li
                key={t.tableId}
                className="border-b border-border-subtle px-5 py-3 last:border-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">
                      {experienceDisplayName(t.experienceName)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-muted">
                      {[
                        t.venue !== "—" ? t.venue : null,
                        t.when !== "—" ? t.when : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Badge tone={statusTone(t.guestBookingStatus)}>
                    Booking · {statusLabel(t.guestBookingStatus)}
                  </Badge>
                </div>
                {t.peers.length === 0 ? (
                  <p className="mt-2 text-[12px] text-text-faint">
                    No other bookings found for this table
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {t.peers.map((p) => (
                      <li
                        key={p.bookingId}
                        className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="min-w-0 truncate font-medium text-ink">
                          {p.userId ? (
                            <Link
                              href={`/guests/${p.userId}`}
                              className="hover:text-accent hover:underline"
                            >
                              {p.guest}
                            </Link>
                          ) : (
                            p.guest
                          )}
                          <span className="ml-2 text-[11px] font-normal text-text-faint">
                            {p.seats} seat{p.seats === 1 ? "" : "s"}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge tone={statusTone(p.bookingStatus)}>
                            Booking · {statusLabel(p.bookingStatus)}
                          </Badge>
                          <Link
                            href={`/bookings/${p.bookingId}`}
                            className="text-[12px] font-semibold text-accent hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Reconnect */}
      <SectionCard title="Reconnect preference">
        <div className="px-5 py-3.5">
          <p className="text-[14px] font-medium text-ink">
            {reconnectPreferenceLabel()}
          </p>
        </div>
      </SectionCard>

      <p className="mt-5 text-[12px]">
        <Link
          href="/guest-experience"
          className="font-semibold text-accent hover:underline"
        >
          Guest Experience
        </Link>
      </p>
    </div>
  );
}

function BookingGroup({
  label,
  rows,
}: {
  label: string;
  rows: EnrichedBookingRow[];
}) {
  return (
    <div>
      <div className="border-b border-border-subtle bg-bg/30 px-5 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
          {label}
          <span className="ml-2 tabular-nums text-text-muted">
            {rows.length}
          </span>
        </p>
      </div>
      <ul>
        {rows.map((b) => (
          <li key={b.id} className="border-b border-border-subtle last:border-0">
            <HistoryRow booking={b} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryRow({ booking: b }: { booking: EnrichedBookingRow }) {
  const router = useRouter();
  const experienceLine = experienceDisplayName(b.experienceName);
  const inclusionLine =
    b.inclusions.length > 0 ? b.inclusions.join(" · ") : null;
  const meal = mealPeriodFromStartsAt(b.startsAtIso);

  function openBooking() {
    router.push(`/bookings/${b.id}`);
  }

  function onKeyActivate(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openBooking();
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openBooking}
      onKeyDown={onKeyActivate}
      className="flex cursor-pointer flex-col gap-2 px-5 py-3 hover:bg-bg-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {b.venue !== "—" ? b.venue : "Venue unavailable"}
          </p>
          <HostedByBadge value={b.hostedBy} short />
          {b.venueId ? (
            <Link
              href={`/venues/${b.venueId}`}
              className="text-[12px] font-semibold text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Venue
            </Link>
          ) : null}
        </div>

        <p className="mt-0.5 text-[13px] text-text-muted">
          {[
            b.when && b.when !== "—" ? b.when : null,
            meal ? mealPeriodLabel(meal) : null,
            b.tableType ? categoryLabel(b.tableType) : null,
            b.seats != null
              ? `${b.seats} seat${b.seats === 1 ? "" : "s"}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Night details unavailable"}
        </p>

        <p className="mt-1 text-[13px] font-medium text-text">{experienceLine}</p>

        {b.menuDescription ? (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-text-faint">
            {b.menuDescription}
          </p>
        ) : null}

        {inclusionLine ? (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-text-faint">
            Includes · {inclusionLine}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <Badge tone={statusTone(b.status)}>
            Booking · {statusLabel(b.status)}
          </Badge>
          {b.paymentStatus ? (
            <Badge tone={statusTone(b.paymentStatus)}>
              Payment · {statusLabel(b.paymentStatus)}
            </Badge>
          ) : (
            <span className="text-[11px] text-text-faint">No payment record</span>
          )}
        </div>
        <p className="text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-ink">
          {b.amount}
        </p>
        {b.paymentMethod ? (
          <p className="text-[11px] text-text-faint">
            {paymentMethodLabel(b.paymentMethod)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function VenueRow({ summary: v }: { summary: VenueVisitSummary }) {
  return (
    <li className="flex flex-col gap-2 border-b border-border-subtle px-5 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {v.venueId ? (
          <Link
            href={`/venues/${v.venueId}`}
            className="truncate text-[14px] font-semibold text-ink hover:text-accent hover:underline"
          >
            {v.venueName}
          </Link>
        ) : (
          <p className="truncate text-[14px] font-semibold text-ink">
            {v.venueName}
          </p>
        )}
        <p className="mt-0.5 text-[12px] tabular-nums text-text-muted">
          {v.bookingRecords} booking record
          {v.bookingRecords === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <Badge tone="neutral">
          Booking · Attended {v.bookingAttended}
        </Badge>
        <Badge tone="neutral">Cancelled {v.cancelled}</Badge>
        <Badge tone="neutral">No-show {v.noShow}</Badge>
        {v.other > 0 ? (
          <Badge tone="neutral">Other {v.other}</Badge>
        ) : null}
      </div>
    </li>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
      <div className="border-b border-border-subtle px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
          {title}
        </p>
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg/40 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        {label}
      </p>
      <p className="mt-1 font-display text-[24px] font-medium tabular-nums tracking-[-0.03em] text-ink">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-text-faint">{hint}</p>
    </div>
  );
}
