"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import { cancelBooking, listBookings } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { confirmDestructive } from "@/lib/console-settings";
import { statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapBookingRow, type BookingRow } from "@/lib/mappers";
import { MOCK_BOOKINGS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

type StatusFilter =
  | "all"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED"
  | "ATTENDED"
  | "NO_SHOW";

export default function BookingsPage() {
  const { mockMode, getToken } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [localRows, setLocalRows] = useState<BookingRow[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listBookings(token);
      return res.bookings.map(mapBookingRow);
    },
  );

  const rows = useMemo(() => {
    if (localRows) return localRows;
    if (mockMode) {
      return MOCK_BOOKINGS.map((b) => ({
        ...b,
        amount: "—",
        paymentStatus: null,
        checkInCode: null,
        bookingType: null,
      }));
    }
    return data ?? [];
  }, [localRows, mockMode, data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (!needle) return true;
      return [b.guest, b.phone, b.venue, b.when, b.checkInCode, b.amount]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, rows, status]);

  async function onCancel(id: string) {
    if (
      !confirmDestructive(
        "Cancel this booking? Captured payments will be refunded.",
      )
    ) {
      return;
    }
    const reason =
      window.prompt("Cancel reason (optional)")?.trim() || undefined;
    setActionError(null);
    if (mockMode) {
      setLocalRows(
        rows.map((b) => (b.id === id ? { ...b, status: "CANCELLED" } : b)),
      );
      return;
    }
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await cancelBooking(token, id, reason);
      setLocalRows(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not cancel booking.",
      );
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="Guest reservations across the network — from hold to check-in."
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}
      {actionError ? (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} />
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guest, phone, venue, code…"
            aria-label="Search bookings"
          />
        </div>
        <div className="flex flex-wrap rounded-xl border border-border bg-bg-elevated p-0.5">
          {(
            [
              ["all", "All"],
              ["PENDING_PAYMENT", "Pending"],
              ["CONFIRMED", "Confirmed"],
              ["ATTENDED", "Attended"],
              ["NO_SHOW", "No-show"],
              ["CANCELLED", "Cancelled"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatus(id)}
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                status === id
                  ? "bg-bg-soft text-ink"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && !mockMode && !data ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "No bookings yet" : "No matching bookings"}
          description={
            rows.length === 0
              ? "When guests book nights, they show up here."
              : "Try another search or status filter."
          }
        />
      ) : (
        <div className="nyto-panel overflow-hidden">
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Venue</th>
                  <th>When</th>
                  <th>Seats</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Check-in</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="font-medium text-ink">{b.guest}</div>
                      <div className="text-[13px] text-text-faint">{b.phone}</div>
                    </td>
                    <td className="text-text-muted">{b.venue}</td>
                    <td className="text-text-muted">{b.when}</td>
                    <td className="tabular-nums">{b.seats}</td>
                    <td className="tabular-nums font-medium text-ink">
                      {b.amount}
                    </td>
                    <td>
                      {b.paymentStatus ? (
                        <Badge tone={statusTone(b.paymentStatus)}>
                          {statusLabel(b.paymentStatus)}
                        </Badge>
                      ) : (
                        <span className="text-[13px] text-text-faint">—</span>
                      )}
                    </td>
                    <td className="font-mono text-[12px] text-text-muted">
                      {b.checkInCode || "—"}
                    </td>
                    <td>
                      <Badge tone={statusTone(b.status)}>
                        {statusLabel(b.status)}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {b.status !== "CANCELLED" &&
                        b.status !== "ATTENDED" &&
                        b.status !== "NO_SHOW" ? (
                          <Button
                            variant="ghost"
                            className="h-8 text-danger hover:bg-danger/10 hover:text-danger"
                            onClick={() => void onCancel(b.id)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                        {b.venueId ? (
                          <Link
                            href={`/venues/${b.venueId}`}
                            className="text-[13px] font-semibold text-accent hover:underline"
                          >
                            Venue
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
