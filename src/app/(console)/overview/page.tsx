"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HostedByBadge } from "@/components/ui/HostedBy";
import {
  ModuleFeed,
  ModuleFeedRow,
  ModuleHero,
} from "@/components/ui/ModuleShell";
import {
  ErrorBanner,
  Skeleton,
} from "@/components/ui/Page";
import { fetchOverview } from "@/lib/api/overview";
import { statusLabel } from "@/lib/format";
import { resolveHostedBy } from "@/lib/hosted-by";
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
  const router = useRouter();
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

  const stats = mockMode ? MOCK_STATS : data?.stats;
  const attention = mockMode ? MOCK_ATTENTION : (data?.attention ?? []);
  const bookings = mockMode
    ? MOCK_BOOKINGS.map((b) => ({
        id: b.id,
        guest: b.guest,
        phone: b.phone,
        email: b.email ?? "—",
        venue: b.venue,
        venueId: b.venueId,
        area: b.area ?? "—",
        when: b.when,
        seats: b.seats,
        status: b.status,
        amount: b.amount ?? "—",
        amountValue: null as number | null,
        paymentId: b.paymentId ?? null,
        paymentStatus: (b.paymentStatus ?? null) as string | null,
        paymentMethod: null as string | null,
        paymentRef: null as string | null,
        checkInCode: b.checkInCode ?? null,
        bookingType: null as string | null,
        tableType: b.tableType ?? null,
        capacity: b.capacity ?? null,
        seatsLeft: b.seatsLeft ?? null,
        hostedBy: resolveHostedBy(b.hostedBy),
        cancelReason: null as string | null,
        createdAt: null as string | null,
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

  const pending = stats?.pendingPayment ?? 0;
  const queueClear = attention.length === 0;

  return (
    <div className="nyto-fade">
      <ModuleHero
        eyebrow="Workspace"
        title="Overview"
        description={
          mockMode
            ? "Demo mock pulse — switch to live for real network data."
            : "Tonight’s network pulse — venues, nights, bookings, money."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/venues">
              <Button variant="secondary">Open venues</Button>
            </Link>
            <Link href="/venues/new">
              <Button>+ Add venue</Button>
            </Link>
          </div>
        }
        stats={
          loading && !mockMode
            ? undefined
            : [
                {
                  label: "Venues",
                  value: String(stats?.activeVenues ?? 0),
                },
                {
                  label: "Nights",
                  value: String(stats?.sessions ?? 0),
                  soft: true,
                },
                {
                  label: "Confirmed",
                  value: String(stats?.confirmed ?? 0),
                  soft: true,
                },
                {
                  label: "Pending pay",
                  value: String(pending),
                  soft: true,
                },
              ]
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <div
        className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-[var(--shadow-sm)] nyto-rise ${
          queueClear
            ? "border-success/20 bg-success/[0.06]"
            : "border-warning/25 bg-warning/[0.07]"
        }`}
        style={{ animationDelay: "80ms" }}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            queueClear ? "bg-success nyto-live-dot" : "bg-warning"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">
            {queueClear ? "Queue clear" : "Needs attention"}
          </p>
          <p className="text-[13px] text-text-muted">
            {queueClear
              ? "Nothing waiting — network is quiet."
              : attention.map((a) => a.label).join(" · ")}
          </p>
        </div>
        {!queueClear ? (
          <div className="flex flex-wrap gap-2">
            {attention.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-accent/40"
              >
                {item.label} →
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {loading && !mockMode ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                Recent bookings
              </h2>
              <Link
                href="/bookings"
                className="text-[12px] font-semibold text-accent hover:underline"
              >
                View all
              </Link>
            </div>
            <ModuleFeed>
              {bookings.length === 0 ? (
                <li className="px-5 py-8 text-center text-[13px] text-text-muted">
                  No bookings yet.
                </li>
              ) : (
                bookings.slice(0, 5).map((b, i) => (
                  <li
                    key={b.id}
                    className="nyto-step-in border-b border-border-subtle last:border-0"
                    style={{ animationDelay: `${100 + i * 40}ms` }}
                  >
                    <ModuleFeedRow
                      onClick={() => router.push(`/bookings/${b.id}`)}
                      className="grid-cols-[1fr_auto] items-center gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[14px] font-semibold text-ink">
                            {b.guest}
                          </p>
                          <HostedByBadge value={b.hostedBy} short />
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-text-faint">
                          {b.venue} · {b.when}
                        </p>
                      </div>
                      <Badge tone={statusTone(b.status)}>
                        {statusLabel(b.status)}
                      </Badge>
                    </ModuleFeedRow>
                  </li>
                ))
              )}
            </ModuleFeed>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                Recent payments
              </h2>
              <Link
                href="/payments"
                className="text-[12px] font-semibold text-accent hover:underline"
              >
                View all
              </Link>
            </div>
            <ModuleFeed>
              {payments.length === 0 ? (
                <li className="px-5 py-8 text-center text-[13px] text-text-muted">
                  No payments yet.
                </li>
              ) : (
                payments.slice(0, 5).map((p, i) => (
                  <li
                    key={p.id}
                    className="nyto-step-in border-b border-border-subtle last:border-0"
                    style={{ animationDelay: `${100 + i * 40}ms` }}
                  >
                    <ModuleFeedRow className="grid-cols-[1fr_auto] items-center gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="tabular-nums text-[14px] font-semibold text-ink">
                            {p.amount}
                          </p>
                          <HostedByBadge value={p.hostedBy} short />
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-text-faint">
                          {"guest" in p ? p.guest : "—"} · {p.venue}
                        </p>
                      </div>
                      <Badge tone={statusTone(p.status)}>
                        {statusLabel(p.status)}
                      </Badge>
                    </ModuleFeedRow>
                  </li>
                ))
              )}
            </ModuleFeed>
          </section>
        </div>
      )}
    </div>
  );
}
