"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { HostedByBadge } from "@/components/ui/HostedBy";
import {
  ModuleFeed,
  ModuleFeedRow,
  ModuleFilters,
  ModuleHero,
  ModulePill,
} from "@/components/ui/ModuleShell";
import { ErrorBanner, Skeleton } from "@/components/ui/Page";
import { listBookings } from "@/lib/api/bookings";
import { experienceDisplayName } from "@/lib/booking-experience";
import { categoryLabel } from "@/lib/categories";
import {
  attendanceDisplayLabel,
  buildGuestJourneyBuckets,
  uniqueGuestCount,
  type GuestJourneyStage,
} from "@/lib/guest-experience";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapBookingRow, type BookingRow } from "@/lib/mappers";
import { MOCK_BOOKINGS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Guest Experience — compact ops dashboard from the capped bookings feed.
 * Complaints, follow-ups, feedback, and admin report notifications are not on
 * admin APIs; summary cards show “Not connected” rather than fabricated zeros.
 * See docs/guest-experience-backend-gaps.md.
 */

type StageFilter = "all" | GuestJourneyStage;

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

export default function GuestExperiencePage() {
  const router = useRouter();
  const { mockMode } = useAuth();
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");

  const { data, error, loading, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listBookings(token);
      return res.bookings.map(mapBookingRow);
    },
  );

  const rows = useMemo(() => {
    if (mockMode) return mockBookingRows();
    return data ?? [];
  }, [mockMode, data]);

  const buckets = useMemo(() => buildGuestJourneyBuckets(rows), [rows]);

  const venues = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.venueId) map.set(r.venueId, r.venue !== "—" ? r.venue : r.venueId);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const beforeRows =
    buckets.find((b) => b.stage === "before_night")?.rows ?? [];
  const awaitingRows =
    buckets.find((b) => b.stage === "awaiting_attendance_record")?.rows ?? [];
  const attendedRows =
    buckets.find((b) => b.stage === "attended")?.rows ?? [];
  const noShowRows = buckets.find((b) => b.stage === "no_show")?.rows ?? [];

  const upcomingGuests = uniqueGuestCount(beforeRows);
  const attendancePendingBookings = awaitingRows.length;

  const statsReady = mockMode || Boolean(data) || !loading;

  const filteredBuckets = useMemo(() => {
    return buckets
      .map((b) => ({
        ...b,
        rows: b.rows.filter((r) =>
          venueFilter === "all" ? true : r.venueId === venueFilter,
        ),
      }))
      .filter((b) => (stageFilter === "all" ? true : b.stage === stageFilter));
  }, [buckets, stageFilter, venueFilter]);

  /** When viewing all stages, hide empty stages to avoid large empty panels. */
  const visibleBuckets = useMemo(() => {
    if (stageFilter !== "all") return filteredBuckets;
    return filteredBuckets.filter((b) => b.rows.length > 0);
  }, [filteredBuckets, stageFilter]);

  const singleStageEmpty =
    stageFilter !== "all" &&
    filteredBuckets.length === 1 &&
    filteredBuckets[0].rows.length === 0;

  return (
    <div className="nyto-fade mx-auto max-w-6xl">
      <ModuleHero
        eyebrow="Operations"
        title="Guest Experience"
        description="Manage guest journeys before, during, and after dining nights."
        stats={[
          {
            label: "Upcoming guests",
            value: statsReady ? String(upcomingGuests) : "—",
            hint: "Distinct guests · feed",
          },
          {
            label: "Attendance pending",
            value: statsReady ? String(attendancePendingBookings) : "—",
            hint: "Bookings · feed",
            soft: attendancePendingBookings === 0,
          },
          {
            label: "Open complaints",
            value: "—",
            hint: "Not connected",
            soft: true,
          },
          {
            label: "Follow-ups due",
            value: "—",
            hint: "Not connected",
            soft: true,
          },
        ]}
      />

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => void reload()} />
        </div>
      ) : null}

      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
            Guest journey
          </h2>
          <p className="text-[11px] text-text-faint">
            Booking feed · not lifetime · booking status ≠ door check-in
          </p>
        </div>

        <ModuleFilters>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <ModulePill
                active={stageFilter === "all"}
                onClick={() => setStageFilter("all")}
                label="All stages"
              />
              <ModulePill
                active={stageFilter === "before_night"}
                onClick={() => setStageFilter("before_night")}
                label="Before the night"
                count={beforeRows.length}
              />
              <ModulePill
                active={stageFilter === "awaiting_attendance_record"}
                onClick={() => setStageFilter("awaiting_attendance_record")}
                label="Attendance pending"
                count={awaitingRows.length}
              />
              <ModulePill
                active={stageFilter === "attended"}
                onClick={() => setStageFilter("attended")}
                label="Attended"
                count={attendedRows.length}
              />
              <ModulePill
                active={stageFilter === "no_show"}
                onClick={() => setStageFilter("no_show")}
                label="No-show"
                count={noShowRows.length}
              />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-text-muted">
              <span className="shrink-0 font-semibold uppercase tracking-[0.1em] text-text-faint">
                Venue
              </span>
              <select
                className="h-9 min-w-[160px] rounded-xl border border-border bg-bg px-3 text-[13px] text-ink"
                value={venueFilter}
                onChange={(e) => setVenueFilter(e.target.value)}
              >
                <option value="all">All venues</option>
                {venues.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </ModuleFilters>

        {loading && !data && !mockMode ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl opacity-80" />
          </div>
        ) : singleStageEmpty ? (
          <p className="rounded-2xl border border-border-subtle bg-bg/30 px-4 py-6 text-center text-[13px] text-text-faint">
            No bookings in this stage
          </p>
        ) : visibleBuckets.length === 0 ? (
          <p className="rounded-2xl border border-border-subtle bg-bg/30 px-4 py-6 text-center text-[13px] text-text-faint">
            No bookings in this stage
          </p>
        ) : (
          <div className="space-y-4">
            {visibleBuckets.map((bucket) => (
              <div key={bucket.stage}>
                {stageFilter === "all" ? (
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                    {bucket.label}
                    <span className="ml-2 tabular-nums text-text-muted">
                      {bucket.rows.length}
                    </span>
                  </p>
                ) : null}
                <ModuleFeed>
                  {bucket.rows.map((row) => (
                    <li
                      key={row.id}
                      className="border-b border-border-subtle last:border-0"
                    >
                      <ModuleFeedRow
                        onClick={() => router.push(`/bookings/${row.id}`)}
                      >
                        <JourneyRow row={row} />
                      </ModuleFeedRow>
                    </li>
                  ))}
                </ModuleFeed>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
        <div className="border-b border-border-subtle px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Guest support
          </p>
        </div>
        <div className="grid gap-px bg-border-subtle sm:grid-cols-2">
          <SupportTile
            label="Complaints"
            message="Complaint records unavailable"
          />
          <SupportTile
            label="Follow-ups"
            message="Follow-up records unavailable"
          />
          <SupportTile label="Guest feedback" message="Feedback unavailable" />
          <SupportTile
            label="Report notifications"
            message="Admin notifications not connected"
          />
        </div>
      </section>
    </div>
  );
}

function JourneyRow({ row }: { row: BookingRow }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-ink">
            {row.guest !== "—" ? row.guest : "Guest unavailable"}
          </p>
          <HostedByBadge value={row.hostedBy} short />
        </div>
        <p className="mt-0.5 text-[12px] text-text-muted">
          {[
            row.venue !== "—" ? row.venue : null,
            experienceDisplayName(row.experienceName),
            row.when && row.when !== "—" ? row.when : null,
            row.tableType ? categoryLabel(row.tableType) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
          {row.userId ? (
            <Link
              href={`/guests/${row.userId}`}
              className="font-semibold text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Guest
            </Link>
          ) : null}
          {row.venueId ? (
            <Link
              href={`/venues/${row.venueId}`}
              className="font-semibold text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Venue
            </Link>
          ) : null}
          <Link
            href={`/bookings/${row.id}`}
            className="font-semibold text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Booking
          </Link>
        </div>
      </div>
      <Badge tone={statusTone(row.status)}>
        {attendanceDisplayLabel(row.status)}
      </Badge>
    </div>
  );
}

function SupportTile({
  label,
  message,
}: {
  label: string;
  message: string;
}) {
  return (
    <div className="bg-bg-elevated px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        {label}
      </p>
      <p className="mt-1.5 text-[13px] text-text-muted">{message}</p>
    </div>
  );
}
