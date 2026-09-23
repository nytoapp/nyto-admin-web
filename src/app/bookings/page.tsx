"use client";

import { useCallback, useEffect, useState } from "react";
import { cancelBooking, listBookings } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import type { AdminBooking } from "@/lib/types";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import { formatWhen, guestName, statusLabel } from "@/lib/format";

export default function BookingsPage() {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await listBookings(token, {
        status: status || undefined,
      });
      setBookings(res.bookings);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load bookings.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCancel(id: string) {
    if (
      !window.confirm(
        "Cancel this booking? This may trigger refund/lifecycle rules on the backend.",
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      const token = await getToken();
      if (!token) return;
      await cancelBooking(token, id, "Cancelled by NYTO admin");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cancel failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Guest reservations across the network."
      />

      <div className="mb-4 max-w-xs">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING_PAYMENT">Pending payment</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="COMPLETED">Completed</option>
        </Select>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <Skeleton className="h-72" />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings"
          description="When guests book nights in the app, they will appear here."
        />
      ) : (
        <div className="nyto-panel">
          <table className="nyto-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Venue</th>
                <th>When</th>
                <th>Seats</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="font-medium">{guestName(b.user)}</div>
                    <div className="text-[12px] text-text-faint">
                      {b.user?.phone || b.user?.email || ""}
                    </div>
                  </td>
                  <td className="text-text-muted">
                    {b.table?.venue?.name || "—"}
                  </td>
                  <td className="text-text-muted">
                    {formatWhen(b.table?.startsAt)}
                  </td>
                  <td className="tabular-nums">{b.seatsBooked}</td>
                  <td>
                    <Badge tone={statusTone(b.status)}>
                      {statusLabel(b.status)}
                    </Badge>
                  </td>
                  <td className="text-right">
                    {b.status !== "CANCELLED" && b.status !== "COMPLETED" ? (
                      <Button
                        variant="ghost"
                        className="h-8 text-danger hover:bg-danger/10 hover:text-danger"
                        disabled={busyId === b.id}
                        onClick={() => void onCancel(b.id)}
                      >
                        {busyId === b.id ? "…" : "Cancel"}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
