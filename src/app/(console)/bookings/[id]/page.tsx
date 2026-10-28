"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HostedByBadge } from "@/components/ui/HostedBy";
import {
  EmptyState,
  ErrorBanner,
  Skeleton,
} from "@/components/ui/Page";
import {
  cancelBooking,
  getBooking,
  markBookingNoShow,
  refundPayment,
} from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { listTableBookings } from "@/lib/api/tables";
import {
  experienceDisplayName,
  resolveMenuForBooking,
} from "@/lib/booking-experience";
import { categoryLabel } from "@/lib/categories";
import { confirmDestructive } from "@/lib/console-settings";
import { guestName, paymentMethodLabel, statusLabel } from "@/lib/format";
import { attendanceDisplayLabel } from "@/lib/guest-experience";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapBookingRow, type BookingRow } from "@/lib/mappers";
import { MOCK_BOOKINGS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

const POLL_MS = 8_000;

function cleanCancelReason(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^NYTO:\s*/i, "")
    .replace(/,\s*,+/g, ",")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
  const lower = cleaned.toLowerCase();
  if (
    !cleaned ||
    cleaned.length < 2 ||
    lower === "nothing" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "-"
  ) {
    return null;
  }
  return cleaned;
}

function mockDetail(id: string): BookingRow | null {
  const b = MOCK_BOOKINGS.find((row) => row.id === id);
  if (!b) return null;
  return {
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
    cancelReason: b.status === "CANCELLED" ? "Guest cancelled" : null,
    createdAt: null,
    tableId: null,
    experienceName: "3-course dinner",
    menuId: null,
    inclusions: ["3-course dinner", "Welcome drink"],
    paymentType: "ALL_INCLUSIVE",
    seatPrice: null,
  };
}

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const router = useRouter();
  const { mockMode, getToken } = useAuth();
  const [local, setLocal] = useState<BookingRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const { data, loading, error, reload } = useAdminResource(
    !mockMode && Boolean(bookingId),
    async (token) => {
      const res = await getBooking(token, bookingId);
      return mapBookingRow(res.booking);
    },
    [bookingId],
  );

  const bookingForExtras = local ?? data;

  const { data: menuMeta } = useAdminResource(
    !mockMode && Boolean(bookingForExtras),
    async (token) => {
      if (!bookingForExtras) return { name: null, description: null };
      return resolveMenuForBooking(token, bookingForExtras);
    },
    [
      bookingForExtras?.id,
      bookingForExtras?.venueId,
      bookingForExtras?.menuId,
      bookingForExtras?.experienceName,
    ],
  );

  const { data: tablePeers } = useAdminResource(
    !mockMode && Boolean(bookingForExtras?.tableId),
    async (token) => {
      if (!bookingForExtras?.tableId) return [];
      const res = await listTableBookings(token, bookingForExtras.tableId);
      return res.bookings
        .filter((b) => b.id !== bookingForExtras.id)
        .map((b) => ({
          id: b.id,
          guest: guestName(b.user),
          status: b.status,
          seats: b.seatsBooked,
        }));
    },
    [bookingForExtras?.tableId, bookingForExtras?.id],
  );

  useEffect(() => {
    if (mockMode) {
      setLocal(mockDetail(bookingId));
      setSyncedAt(new Date());
    }
  }, [mockMode, bookingId]);

  useEffect(() => {
    if (mockMode) return;
    const id = window.setInterval(() => {
      void reload({ silent: true }).then(() => setSyncedAt(new Date()));
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [mockMode, reload]);

  useEffect(() => {
    if (data) {
      setLocal(null);
      setSyncedAt(new Date());
    }
  }, [data]);

  const booking = useMemo(() => {
    if (local) return local;
    if (mockMode) return mockDetail(bookingId);
    return data;
  }, [local, mockMode, bookingId, data]);

  async function onCancel() {
    if (!booking) return;
    if (
      !confirmDestructive(
        "Cancel this booking? Captured payments will be refunded where supported.",
      )
    ) {
      return;
    }
    const reason =
      window.prompt("Cancel reason (optional)")?.trim() || undefined;
    setActionError(null);
    setBusy(true);
    try {
      if (mockMode) {
        setLocal({
          ...booking,
          status: "CANCELLED",
          paymentStatus:
            booking.paymentStatus === "CAPTURED"
              ? "REFUNDED"
              : booking.paymentStatus,
          cancelReason: reason ?? "Cancelled by admin",
        });
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await cancelBooking(token, booking.id, reason);
      setLocal(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not cancel booking.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onMarkNoShow() {
    if (!booking) return;
    if (
      !confirmDestructive(
        "Mark this guest as no-show? They can still check in late at the door.",
      )
    ) {
      return;
    }
    setActionError(null);
    setBusy(true);
    try {
      if (mockMode) {
        setLocal({
          ...booking,
          status: "NO_SHOW",
          cancelReason: "NO_SHOW",
        });
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await markBookingNoShow(token, booking.id);
      setLocal(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not mark no-show.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onRefund() {
    if (!booking?.paymentId) return;
    if (
      !confirmDestructive(
        "Refund this payment? The booking will cancel if still open.",
      )
    ) {
      return;
    }
    const reason =
      window.prompt("Refund reason (optional)")?.trim() || undefined;
    setActionError(null);
    setBusy(true);
    try {
      if (mockMode) {
        setLocal({
          ...booking,
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          cancelReason: reason ?? "Refunded by admin",
        });
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await refundPayment(token, booking.paymentId, reason);
      setLocal(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not refund payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !mockMode && !booking) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!booking) {
    return (
      <EmptyState
        title="Booking not found"
        description="It may have been removed, or the link is stale."
        action={
          <Button variant="secondary" onClick={() => router.push("/bookings")}>
            Back to bookings
          </Button>
        }
      />
    );
  }

  const canCancel =
    booking.status !== "CANCELLED" &&
    booking.status !== "ATTENDED" &&
    booking.status !== "NO_SHOW";
  const nightStarted = booking.startsAtIso
    ? new Date(booking.startsAtIso).getTime() <= Date.now()
    : false;
  const canMarkNoShow =
    booking.status === "CONFIRMED" && nightStarted;
  const canRefund =
    Boolean(booking.paymentId) && booking.paymentStatus === "CAPTURED";
  const cancelNote = cleanCancelReason(booking.cancelReason);
  const methodLabel = booking.paymentMethod
    ? paymentMethodLabel(booking.paymentMethod)
    : "Unknown";
  const isSettled =
    booking.status === "CANCELLED" || booking.status === "NO_SHOW";
  const seatsLine =
    booking.seats != null && booking.capacity != null
      ? `${booking.seats} of ${booking.capacity} seats`
      : booking.seats != null
        ? `${booking.seats} seat${booking.seats === 1 ? "" : "s"}`
        : "Seats unavailable";

  const amountCaption =
    booking.paymentStatus === "REFUNDED"
      ? "Linked payment amount · refunded"
      : booking.paymentStatus === "CAPTURED"
        ? "Linked payment amount · captured"
        : booking.paymentStatus
          ? "Linked payment amount"
          : "Amount unavailable";

  return (
    <div className="nyto-fade mx-auto max-w-4xl">
      <Link
        href="/bookings"
        className="inline-flex text-[13px] font-semibold text-text-muted transition hover:text-accent"
      >
        ← Bookings
      </Link>

      <header className="nyto-bookings-hero relative mt-5 overflow-hidden rounded-[22px] border border-border bg-bg-elevated shadow-[var(--shadow-md)]">
        <div
          className={`pointer-events-none absolute inset-0 opacity-90 ${
            booking.hostedBy === "PARTNER"
              ? "bg-[radial-gradient(900px_420px_at_0%_-10%,rgba(52,211,153,0.14),transparent_55%)]"
              : "bg-[radial-gradient(900px_420px_at_0%_-10%,rgba(77,139,255,0.18),transparent_55%)]"
          }`}
          aria-hidden
        />
        <div className="relative z-[2] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
              Booking
            </p>
            <span className="text-text-faint">·</span>
            <HostedByBadge value={booking.hostedBy} short />
            {booking.tableType ? (
              <span className="rounded-full border border-border bg-bg/50 px-2.5 py-0.5 text-[11px] font-semibold text-text-muted backdrop-blur">
                {categoryLabel(booking.tableType)}
              </span>
            ) : null}
            <Badge tone={statusTone(booking.status)}>
              Booking · {statusLabel(booking.status)}
            </Badge>
            {booking.paymentStatus ? (
              <Badge tone={statusTone(booking.paymentStatus)}>
                Payment · {statusLabel(booking.paymentStatus)}
              </Badge>
            ) : null}
            {syncedAt ? (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] tabular-nums text-text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-accent nyto-live-dot" />
                Updated ·{" "}
                {syncedAt.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                  timeZone: "Asia/Kolkata",
                })}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.04em] text-ink sm:text-[42px]">
                {booking.guest}
              </h1>
              {booking.checkInCode ? (
                <p className="mt-1 font-mono text-[13px] text-text-faint">
                  Check-in {booking.checkInCode}
                </p>
              ) : null}
              <p className="mt-2 text-[15px] text-text-muted">
                {booking.venue}
                {booking.area && booking.area !== "—"
                  ? ` · ${booking.area}`
                  : ""}
              </p>
              <p className="mt-1 text-[13px] text-text-faint">
                {booking.when} · {seatsLine}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                {amountCaption}
              </p>
              <p className="nyto-amount-hero mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.03em]">
                {booking.amount}
              </p>
            </div>
          </div>

          <p className="mt-5 max-w-2xl border-t border-border-subtle pt-4 text-[13px] leading-relaxed text-text-faint">
            {booking.hostedBy === "PARTNER"
              ? "Venue-organized night — the venue publishes this experience; shown here for monitoring."
              : "NYTO-organized night — admin published this experience for the guest app."}
            {!isSettled && booking.seatsLeft != null
              ? ` · ${booking.seatsLeft} seat${booking.seatsLeft === 1 ? "" : "s"} still open on this table.`
              : null}
          </p>
        </div>
      </header>

      {error ? (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={() => void reload()} />
        </div>
      ) : null}
      {actionError ? (
        <div className="mt-4">
          <ErrorBanner
            message={actionError}
            onRetry={() => setActionError(null)}
          />
        </div>
      ) : null}

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
        <div className="border-b border-border-subtle px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Attendance & guest experience
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] font-medium text-ink">
            {attendanceDisplayLabel(booking.status)}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
            Booking status is not physical door check-in. Guest complaints and
            follow-ups for this night will appear in{" "}
            <Link
              href="/guest-experience"
              className="font-semibold text-accent hover:underline"
            >
              Guest Experience
            </Link>{" "}
            once report APIs are connected.
          </p>
        </div>
      </section>

      {/* Dossier — guest + payment as one board */}
      <section className="nyto-dossier mt-4 overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
        <div className="grid lg:grid-cols-2">
          <div className="border-b border-border-subtle p-5 lg:border-b-0 lg:border-r">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              Guest
            </p>
            <dl className="mt-4 space-y-0">
              <DossierRow label="Name" value={booking.guest} />
              <DossierRow label="Phone" value={booking.phone} />
              <DossierRow label="Email" value={booking.email} />
              <DossierRow
                label="Check-in"
                value={booking.checkInCode || "—"}
                mono
                copyable={Boolean(booking.checkInCode)}
                last
              />
            </dl>
          </div>
          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              Payment
            </p>
            <dl className="mt-4 space-y-0">
              <DossierRow label="Amount" value={booking.amount} />
              <DossierRow
                label="Payment status"
                value={
                  booking.paymentStatus
                    ? statusLabel(booking.paymentStatus)
                    : "No payment record"
                }
              />
              <DossierRow
                label="Method"
                value={
                  booking.paymentStatus || booking.paymentMethod
                    ? methodLabel
                    : "Unknown"
                }
              />
              <DossierRow
                label="Reference"
                value={booking.paymentRef || "—"}
                mono
                copyable={Boolean(booking.paymentRef)}
                last
              />
            </dl>
          </div>
        </div>
      </section>

      {/* What the seat price includes — from scheduled night + optional menu copy */}
      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
        <div className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Experience · included with seat
          </p>
          <p className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-ink">
            {experienceDisplayName(
              booking.experienceName || menuMeta?.name,
            )}
          </p>
          {menuMeta?.description ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
              {menuMeta.description}
            </p>
          ) : null}
          <dl className="mt-4 space-y-0">
            <DossierRow
              label="Seat price"
              value={
                booking.seatPrice != null
                  ? `₹${booking.seatPrice.toLocaleString("en-IN")}`
                  : booking.amount
              }
            />
            <DossierRow
              label="Bill type"
              value={
                booking.paymentType
                  ? statusLabel(booking.paymentType)
                  : "Unavailable"
              }
            />
            <DossierRow
              label="Category"
              value={
                booking.tableType
                  ? categoryLabel(booking.tableType)
                  : "Unavailable"
              }
              last={booking.inclusions.length === 0}
            />
            {booking.inclusions.length > 0 ? (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 py-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
                  Includes
                </dt>
                <dd className="min-w-0">
                  <ul className="flex flex-wrap gap-1.5">
                    {booking.inclusions.map((item) => (
                      <li key={item}>
                        <Badge tone="neutral">{item}</Badge>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : (
              <p className="pt-2 text-[12px] text-text-faint">
                No inclusion list on this night record.
              </p>
            )}
          </dl>
          {booking.userId ? (
            <p className="mt-4 border-t border-border-subtle pt-3 text-[13px]">
              <Link
                href={`/guests/${booking.userId}`}
                className="font-semibold text-accent hover:underline"
              >
                Open guest history →
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      {/* Other guests who also booked seats at this table — only when someone else exists */}
      {!mockMode &&
      booking.tableId &&
      tablePeers &&
      tablePeers.length > 0 ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              Same table
            </p>
            <p className="mt-1 text-[13px] text-text-muted">
              Other guests who also booked seats at this table for this night.
            </p>
            <ul className="mt-3 divide-y divide-border-subtle">
              {tablePeers.map((peer) => (
                <li
                  key={peer.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/bookings/${peer.id}`}
                      className="truncate text-[14px] font-semibold text-ink hover:text-accent"
                    >
                      {peer.guest}
                    </Link>
                    <p className="text-[12px] text-text-faint">
                      {peer.seats} seat{peer.seats === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Badge tone={statusTone(peer.status)}>
                    {statusLabel(peer.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Venue — whole strip clickable */}
      {booking.venueId ? (
        <Link
          href={`/venues/${booking.venueId}`}
          className="nyto-venue-strip group mt-4 flex items-center justify-between gap-4 rounded-2xl border border-border bg-bg-elevated/70 px-5 py-4 shadow-[var(--shadow-sm)] hover:border-accent/35 hover:bg-bg-hover/60"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              Venue
            </p>
            <p className="mt-1.5 truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">
              {booking.venue}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-text-faint">
              {[booking.area !== "—" ? booking.area : null, booking.when]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-accent transition duration-200 group-hover:translate-x-1">
            Open →
          </span>
        </Link>
      ) : (
        <div className="nyto-venue-strip mt-4 rounded-2xl border border-border bg-bg-elevated/70 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Venue
          </p>
          <p className="mt-1.5 text-[16px] font-semibold text-ink">
            {booking.venue}
          </p>
          <p className="mt-0.5 text-[13px] text-text-faint">{booking.when}</p>
        </div>
      )}

      {cancelNote ? (
        <p className="mt-4 rounded-2xl border border-border bg-bg-soft/80 px-4 py-3 text-[13px] text-text-muted">
          <span className="font-semibold text-text">Note · </span>
          {cancelNote}
        </p>
      ) : null}

      {(canCancel || canRefund || canMarkNoShow) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {canCancel ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void onCancel()}
            >
              {busy ? "Working…" : "Cancel booking"}
            </Button>
          ) : null}
          {canMarkNoShow ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void onMarkNoShow()}
            >
              {busy ? "Working…" : "Mark no-show"}
            </Button>
          ) : null}
          {canRefund ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void onRefund()}
            >
              {busy ? "Working…" : "Refund payment"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DossierRow({
  label,
  value,
  mono,
  last,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    if (!copyable || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`grid grid-cols-[88px_minmax(0,1fr)] items-baseline gap-3 py-2.5 ${
        last ? "" : "border-b border-border-subtle"
      }`}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
        {label}
      </dt>
      <dd className="min-w-0">
        {copyable && value !== "—" ? (
          <button
            type="button"
            onClick={() => void onCopy()}
            title="Click to copy"
            className={`truncate text-left text-[14px] font-medium text-ink transition hover:text-accent ${
              mono ? "font-mono text-[12.5px] tracking-tight" : ""
            }`}
          >
            {copied ? "Copied" : value}
          </button>
        ) : (
          <span
            className={`truncate text-[14px] font-medium text-ink ${
              mono ? "font-mono text-[12.5px] tracking-tight" : ""
            }`}
          >
            {value}
          </span>
        )}
      </dd>
    </div>
  );
}
