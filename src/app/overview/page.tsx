"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listBookings, listPayments } from "@/lib/api/bookings";
import { listVenues } from "@/lib/api/venues";
import { listHostApplications } from "@/lib/api/hosts";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import type { AdminBooking, AdminPayment, Venue } from "@/lib/types";
import type { HostApplication } from "@/lib/api/hosts";
import { Badge, statusTone } from "@/components/ui/Badge";
import { ErrorBanner, PageHeader, Skeleton, StatCard } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import {
  formatMoneyInr,
  formatWhen,
  guestName,
  statusLabel,
} from "@/lib/format";

export default function OverviewPage() {
  const { getToken } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [hosts, setHosts] = useState<HostApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const [v, b, p, h] = await Promise.all([
        listVenues(token),
        listBookings(token),
        listPayments(token),
        listHostApplications(token, "PENDING"),
      ]);
      setVenues(v.venues);
      setBookings(b.bookings);
      setPayments(p.payments);
      setHosts(h.applications);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load overview.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const activeVenues = venues.filter((v) => v.isActive).length;
    const sessions = venues.reduce((n, v) => n + (v._count?.tables ?? 0), 0);
    const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
    const pendingPay = bookings.filter((b) => b.status === "PENDING_PAYMENT");
    return {
      activeVenues,
      sessions,
      confirmed,
      pendingPayCount: pendingPay.length,
    };
  }, [venues, bookings]);

  const recentBookings = useMemo(
    () => bookings.slice(0, 8),
    [bookings],
  );

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Pulse across venues, sessions, and guest bookings."
        actions={
          <Link href="/venues/new">
            <Button>+ Add venue</Button>
          </Link>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active venues" value={String(stats.activeVenues)} />
            <StatCard label="Sessions" value={String(stats.sessions)} />
            <StatCard label="Confirmed" value={String(stats.confirmed)} />
            <StatCard
              label="Pending payment"
              value={String(stats.pendingPayCount)}
            />
          </div>

          {hosts.length > 0 || stats.pendingPayCount > 0 ? (
            <div className="nyto-panel mt-6 p-4">
              <h2 className="mb-3 text-[13px] font-semibold">Needs attention</h2>
              <div className="flex flex-wrap gap-2">
                {hosts.length > 0 ? (
                  <Link
                    href="/host-applications"
                    className="inline-flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-[13px] transition hover:border-warning/40"
                  >
                    <span className="font-semibold tabular-nums text-warning">
                      {hosts.length}
                    </span>
                    <span className="text-text-muted">
                      host application{hosts.length === 1 ? "" : "s"}
                    </span>
                  </Link>
                ) : null}
                {stats.pendingPayCount > 0 ? (
                  <Link
                    href="/bookings"
                    className="inline-flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-[13px] transition hover:border-warning/40"
                  >
                    <span className="font-semibold tabular-nums text-warning">
                      {stats.pendingPayCount}
                    </span>
                    <span className="text-text-muted">
                      pending payment{stats.pendingPayCount === 1 ? "" : "s"}
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="nyto-panel">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <h2 className="text-[13px] font-semibold">Recent bookings</h2>
                <Link
                  href="/bookings"
                  className="text-[12px] font-semibold text-accent-soft hover:underline"
                >
                  View all
                </Link>
              </div>
              <table className="nyto-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>When</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="font-medium">{guestName(b.user)}</div>
                        <div className="text-[12px] text-text-faint">
                          {b.table?.venue?.name || "—"}
                        </div>
                      </td>
                      <td className="text-text-muted">
                        {formatWhen(b.table?.startsAt)}
                      </td>
                      <td>
                        <Badge tone={statusTone(b.status)}>
                          {statusLabel(b.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {recentBookings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-10 text-center text-text-muted"
                      >
                        No bookings yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>

            <section className="nyto-panel">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <h2 className="text-[13px] font-semibold">Recent payments</h2>
                <Link
                  href="/payments"
                  className="text-[12px] font-semibold text-accent-soft hover:underline"
                >
                  View all
                </Link>
              </div>
              <table className="nyto-table">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Venue</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 8).map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium tabular-nums">
                        {formatMoneyInr(p.amountInr ?? p.amount)}
                      </td>
                      <td className="text-text-muted">
                        {p.booking?.table?.venue?.name || "—"}
                      </td>
                      <td>
                        <Badge tone={statusTone(p.status)}>
                          {statusLabel(p.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-10 text-center text-text-muted"
                      >
                        No payments yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
