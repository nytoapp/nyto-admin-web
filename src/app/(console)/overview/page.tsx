"use client";

import Link from "next/link";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HostedByBadge } from "@/components/ui/HostedBy";
import {
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatCard,
} from "@/components/ui/Page";
import { resolveHostedBy } from "@/lib/hosted-by";
import { fetchOverview } from "@/lib/api/overview";
import { loadConsoleSettings } from "@/lib/console-settings";
import { statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapBookingRow, mapPaymentRow } from "@/lib/mappers";
import {
  MOCK_ATTENTION,
  MOCK_BOOKINGS,
  MOCK_PAYMENTS,
  MOCK_STATS,
} from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

export default function OverviewPage() {
  const { mockMode } = useAuth();
  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await fetchOverview(token);
      return {
        stats: res.stats,
        attention: res.attention,
        bookings: res.recentBookings.map(mapBookingRow),
        payments: res.recentPayments.map(mapPaymentRow),
      };
    },
  );

  const highlightPending = loadConsoleSettings().highlightPending;
  const stats = mockMode ? MOCK_STATS : data?.stats;
  const attentionRaw = mockMode ? MOCK_ATTENTION : (data?.attention ?? []);
  const attention = highlightPending
    ? attentionRaw
    : attentionRaw.filter(
        (item) => !/pending payment/i.test(item.label || item.id || ""),
      );
  const bookings = mockMode
    ? MOCK_BOOKINGS.map((b) => ({
        ...b,
        amount: "—",
        paymentStatus: null as string | null,
        checkInCode: null as string | null,
        bookingType: null as string | null,
        hostedBy: resolveHostedBy(b.hostedBy),
      }))
    : (data?.bookings ?? []);
  const payments = mockMode
    ? MOCK_PAYMENTS.map((p) => ({
        ...p,
        amountValue: 0,
        method: null as string | null,
        providerRef: null as string | null,
        bookingId: null as string | null,
        hostedBy: resolveHostedBy(p.hostedBy),
      }))
    : (data?.payments ?? []);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description={
          mockMode
            ? "UI mock data — set NEXT_PUBLIC_AUTH_MODE=live to use the API."
            : "Live pulse across venues, sessions, bookings, and payments."
        }
        actions={
          <Link href="/venues/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">+ Add venue</Button>
          </Link>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

      {loading && !mockMode ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active venues"
            value={String(stats?.activeVenues ?? 0)}
          />
          <StatCard
            label="Sessions"
            value={String(stats?.sessions ?? 0)}
            hint="Excludes cancelled nights"
          />
          <StatCard
            label="Confirmed"
            value={String(stats?.confirmed ?? 0)}
            hint="Paid bookings"
          />
          <StatCard
            label="Pending payment"
            value={String(stats?.pendingPayment ?? 0)}
            hint="Awaiting capture"
          />
        </div>
      )}

      <div className="nyto-panel mt-5 p-4 sm:mt-6 sm:p-5">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">
          Needs attention
        </h2>
        {attention.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attention.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="nyto-fade inline-flex items-center rounded-xl border border-warning/25 bg-warning/8 px-3.5 py-2.5 text-[14px] font-medium text-text transition hover:border-warning/40"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-success/20 bg-success/8 px-3.5 py-2.5 text-[14px] font-medium text-success">
            Queue clear — nothing waiting right now.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-5 sm:mt-6 sm:gap-6 lg:grid-cols-2">
        <section className="nyto-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5 sm:px-5">
            <h2 className="text-[15px] font-semibold text-ink">Recent bookings</h2>
            <Link
              href="/bookings"
              className="text-[13px] font-semibold text-accent hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>When</th>
                  <th>Hosted by</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-text-muted">
                      No bookings yet.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="font-medium text-ink">{b.guest}</div>
                        <div className="text-[13px] text-text-faint">{b.venue}</div>
                      </td>
                      <td className="text-text-muted">{b.when}</td>
                      <td>
                        <HostedByBadge value={b.hostedBy} short />
                      </td>
                      <td className="tabular-nums text-text-muted">
                        {"amount" in b ? b.amount : "—"}
                      </td>
                      <td>
                        <Badge tone={statusTone(b.status)}>
                          {statusLabel(b.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="nyto-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5 sm:px-5">
            <h2 className="text-[15px] font-semibold text-ink">Recent payments</h2>
            <Link
              href="/payments"
              className="text-[13px] font-semibold text-accent hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Guest</th>
                  <th>Venue</th>
                  <th>Hosted by</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-text-muted">
                      No payments yet — they appear after checkout starts.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium tabular-nums text-ink">
                        {p.amount}
                      </td>
                      <td className="text-text-muted">
                        {"guest" in p ? p.guest : "—"}
                      </td>
                      <td className="text-text-muted">{p.venue}</td>
                      <td>
                        <HostedByBadge value={p.hostedBy} short />
                      </td>
                      <td>
                        <Badge tone={statusTone(p.status)}>
                          {statusLabel(p.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
