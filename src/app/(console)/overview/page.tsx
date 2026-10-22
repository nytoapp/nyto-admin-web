"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HostedByBadge } from "@/components/ui/HostedBy";
import { ModuleFeed, ModuleFeedRow } from "@/components/ui/ModuleShell";
import { ErrorBanner, Skeleton } from "@/components/ui/Page";
import { listBookings } from "@/lib/api/bookings";
import { listHostApplications } from "@/lib/api/hosts";
import { fetchOverview } from "@/lib/api/overview";
import { listTables } from "@/lib/api/tables";
import { formatMoneyInr, statusLabel } from "@/lib/format";
import { resolveHostedBy } from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { bookingFeedKpis } from "@/lib/kpi";
import { seatsLine, selectUpcomingNights } from "@/lib/overview-schedule";
import { mapBookingRow, mapPaymentRow } from "@/lib/mappers";
import { MOCK_BOOKINGS, MOCK_PAYMENTS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Bookings list API is capped (take: 100) — Overview booking KPIs are feed-scoped.
 * Overview finance + paymentsFailed are ledger aggregates (not list sums).
 */

const MOCK_FINANCE = {
  currency: "INR" as const,
  capturedAmount: 12990,
  refundedAmount: 1299,
};

const SCHEDULE_PREVIEW = 5;

type AttentionRow = {
  id: string;
  title: string;
  detail: string;
  href: string;
  count?: number;
};

export default function OverviewPage() {
  const router = useRouter();
  const { mockMode } = useAuth();

  const overview = useAdminResource(!mockMode, async (token) => {
    const res = await fetchOverview(token);
    return {
      ...res,
      bookings: res.recentBookings.map(mapBookingRow),
      payments: res.recentPayments.map(mapPaymentRow),
    };
  });

  const tablesRes = useAdminResource(!mockMode, async (token) => {
    const res = await listTables(token);
    return res.tables;
  });

  const bookingsRes = useAdminResource(!mockMode, async (token) => {
    const res = await listBookings(token);
    return res.bookings.map(mapBookingRow);
  });

  const hostsRes = useAdminResource(!mockMode, async (token) => {
    const res = await listHostApplications(token, "PENDING");
    return res.applications;
  });

  const upcoming = useMemo(() => {
    if (mockMode) return [];
    return selectUpcomingNights(tablesRes.data ?? []);
  }, [mockMode, tablesRes.data]);

  const bookingKpis = mockMode
    ? bookingFeedKpis(MOCK_BOOKINGS)
    : bookingsRes.data
      ? bookingFeedKpis(bookingsRes.data)
      : null;

  const ov = overview.data;
  const finance = mockMode
    ? MOCK_FINANCE
    : ov?.finance
      ? {
          capturedAmount: ov.finance.capturedAmount,
          refundedAmount: ov.finance.refundedAmount,
        }
      : null;
  const failedPayments = mockMode
    ? 0
    : (ov?.stats?.paymentsFailed ?? null);

  const recentBookings = mockMode
    ? MOCK_BOOKINGS.map((b) => ({
        id: b.id,
        guest: b.guest,
        venue: b.venue,
        when: b.when,
        status: b.status,
        paymentStatus: (b.paymentStatus ?? null) as string | null,
        hostedBy: resolveHostedBy(b.hostedBy),
      }))
    : (ov?.bookings ?? []).map((b) => ({
        id: b.id,
        guest: b.guest,
        venue: b.venue,
        when: b.when,
        status: b.status,
        paymentStatus: b.paymentStatus,
        hostedBy: b.hostedBy,
      }));

  const recentPayments = mockMode
    ? MOCK_PAYMENTS.map((p) => ({
        ...p,
        bookingId: null as string | null,
        hostedBy: resolveHostedBy(p.hostedBy),
      }))
    : (ov?.payments ?? []);

  const attention: AttentionRow[] = useMemo(() => {
    const items: AttentionRow[] = [];
    if (mockMode) return items;

    const hostsPending = hostsRes.data?.length;
    if (
      !hostsRes.error &&
      hostsRes.data &&
      typeof hostsPending === "number" &&
      hostsPending > 0
    ) {
      items.push({
        id: "hosts-pending",
        title: "Requests awaiting review",
        detail: "Approve to create a Venue-organized venue, or reject.",
        href: "/host-applications?status=PENDING",
        count: hostsPending,
      });
    }

    if (!overview.error && failedPayments != null && failedPayments > 0) {
      items.push({
        id: "payments-failed",
        title: "Failed payments to review",
        detail: "Payment records with FAILED status need follow-up.",
        href: "/payments?status=FAILED",
        count: failedPayments,
      });
    }

    return items;
  }, [
    mockMode,
    hostsRes.data,
    hostsRes.error,
    overview.error,
    failedPayments,
  ]);

  const queueLoading =
    !mockMode &&
    (hostsRes.loading || overview.loading) &&
    !(hostsRes.data != null && ov != null);

  const queueVerified =
    mockMode ||
    (!hostsRes.error &&
      !overview.error &&
      hostsRes.data != null &&
      ov != null);

  const showAttentionSection =
    queueLoading || !queueVerified || attention.length > 0;

  return (
    <div className="nyto-fade space-y-7">
      <header className="nyto-bookings-hero relative overflow-hidden rounded-[22px] border border-border bg-bg-elevated shadow-[var(--shadow-md)]">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent/15 blur-3xl nyto-drift"
          aria-hidden
        />
        <div className="relative z-[2] flex flex-col gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
              Workspace
            </p>
            <h1 className="mt-2 font-display text-[34px] font-medium leading-none tracking-[-0.04em] text-ink sm:text-[40px]">
              Overview
            </h1>
            <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-text-muted">
              Your NYTO operation at a glance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/venues">
              <Button variant="secondary">Open venues</Button>
            </Link>
            <Link href="/venues/new">
              <Button>+ Add venue</Button>
            </Link>
          </div>
        </div>
      </header>

      {overview.error ? (
        <ErrorBanner
          message={overview.error}
          onRetry={() => void overview.reload()}
        />
      ) : null}

      {/* Upcoming dining nights */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[20px] font-medium tracking-[-0.02em] text-ink">
              Upcoming dining nights
            </h2>
            {!tablesRes.loading && !tablesRes.error ? (
              <p className="mt-1 text-[13px] text-text-muted">
                {upcoming.length === 0
                  ? "No nights scheduled after now"
                  : `${upcoming.length} scheduled`}
              </p>
            ) : null}
          </div>
          <Link
            href="/venues"
            className="shrink-0 text-[12px] font-semibold text-accent hover:underline"
          >
            View venues
          </Link>
        </div>

        {tablesRes.loading && !mockMode ? (
          <Skeleton className="h-44" />
        ) : tablesRes.error ? (
          <div className="rounded-2xl border border-danger/25 bg-danger/[0.06] px-4 py-4">
            <p className="text-[14px] font-semibold text-ink">
              Could not load upcoming nights
            </p>
            <button
              type="button"
              onClick={() => void tablesRes.reload()}
              className="mt-2 text-[13px] font-semibold text-accent hover:underline"
            >
              Retry
            </button>
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl border border-border bg-bg-elevated/80 px-5 py-8 text-center">
            <p className="text-[15px] font-semibold text-ink">
              No upcoming dining nights
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-text-muted">
              Schedule a night from a venue to start taking bookings.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/venues/new">
                <Button>+ Add venue</Button>
              </Link>
              <Link href="/venues">
                <Button variant="secondary">Open venues</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
            <ul>
              {upcoming.slice(0, SCHEDULE_PREVIEW).map((n) => {
                const seats = seatsLine(n);
                return (
                  <li
                    key={n.id}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/venues/${n.venueId}`)}
                      className="grid w-full grid-cols-1 gap-2 px-4 py-3.5 text-left transition hover:bg-bg-hover/60 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[14px] font-semibold text-ink">
                            {n.venueName}
                          </p>
                          <HostedByBadge value={n.hostedBy} short />
                        </div>
                        {n.experience ? (
                          <p className="mt-0.5 truncate text-[12px] text-text-faint">
                            {n.experience}
                          </p>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium tabular-nums text-text">
                          {n.whenLabel}
                        </p>
                        {seats ? (
                          <p className="mt-0.5 text-[12px] text-text-faint">
                            {seats}
                          </p>
                        ) : null}
                      </div>
                      <Badge tone={n.bookingStateTone}>
                        {n.bookingStateLabel}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
            {upcoming.length > SCHEDULE_PREVIEW ? (
              <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 text-[12px] text-text-faint">
                <span>
                  Next {SCHEDULE_PREVIEW} of {upcoming.length}
                </span>
                <Link
                  href="/venues"
                  className="font-semibold text-accent hover:underline"
                >
                  View venues
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Needs attention — omit entirely when verified empty */}
      {showAttentionSection ? (
        <section>
          {(queueLoading || !queueVerified || attention.length > 0) && (
            <h2 className="mb-2 font-display text-[20px] font-medium tracking-[-0.02em] text-ink">
              Needs attention
            </h2>
          )}
          {queueLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : !queueVerified ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="text-text-muted">
                Could not verify open work.
              </span>
              <button
                type="button"
                onClick={() => {
                  void hostsRes.reload();
                  void overview.reload();
                }}
                className="font-semibold text-accent hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border divide-y divide-border-subtle">
              {attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start justify-between gap-3 px-4 py-3.5 transition hover:bg-bg-hover/50"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ink">
                        {item.count != null ? `${item.count} · ` : ""}
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-text-faint">
                        {item.detail}
                      </p>
                    </div>
                    <span className="shrink-0 pt-0.5 text-[12px] font-semibold text-accent">
                      Review →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Bookings + Payments */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-bg-elevated/60 p-4 sm:p-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="font-display text-[18px] font-medium text-ink">
              Bookings
            </h2>
            <Link
              href="/bookings"
              className="text-[12px] font-semibold text-accent hover:underline"
            >
              View bookings
            </Link>
          </div>
          <p className="mb-4 text-[11px] text-text-faint">
            Records in current feed
          </p>
          {bookingsRes.loading && !mockMode && !bookingKpis ? (
            <Skeleton className="h-14" />
          ) : bookingsRes.error && !bookingKpis ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="text-text-muted">Could not load bookings.</span>
              <button
                type="button"
                onClick={() => void bookingsRes.reload()}
                className="font-semibold text-accent hover:underline"
              >
                Retry
              </button>
            </div>
          ) : bookingKpis ? (
            <dl className="grid grid-cols-3 gap-3">
              <Mini
                label="Total bookings"
                value={String(bookingKpis.totalBookings)}
              />
              <Mini
                label="Confirmed bookings"
                value={String(bookingKpis.confirmed)}
              />
              <Mini
                label="Cancelled bookings"
                value={String(bookingKpis.cancelled)}
              />
            </dl>
          ) : (
            <p className="text-[13px] text-text-muted">Unavailable.</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-bg-elevated/60 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-[18px] font-medium text-ink">
              Payments
            </h2>
            <Link
              href="/payments"
              className="text-[12px] font-semibold text-accent hover:underline"
            >
              View payments
            </Link>
          </div>
          {overview.loading &&
          !mockMode &&
          !finance &&
          failedPayments == null ? (
            <Skeleton className="h-14" />
          ) : overview.error && !finance && failedPayments == null ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="text-text-muted">
                Could not load payment totals.
              </span>
              <button
                type="button"
                onClick={() => void overview.reload()}
                className="font-semibold text-accent hover:underline"
              >
                Retry
              </button>
            </div>
          ) : finance || failedPayments != null ? (
            <dl className="grid grid-cols-3 gap-3">
              {finance ? (
                <Mini
                  label="Successfully captured"
                  value={formatMoneyInr(finance.capturedAmount)}
                />
              ) : null}
              {finance ? (
                <Mini
                  label="Refunded amount"
                  value={formatMoneyInr(finance.refundedAmount)}
                />
              ) : null}
              {failedPayments != null ? (
                <Mini
                  label="Failed payments"
                  value={String(failedPayments)}
                />
              ) : null}
            </dl>
          ) : (
            <p className="text-[13px] text-text-muted">Unavailable.</p>
          )}
        </section>
      </div>

      {/* Recent activity */}
      <section>
        <h2 className="mb-3 font-display text-[20px] font-medium tracking-[-0.02em] text-ink">
          Recent activity
        </h2>
        {overview.loading && !mockMode ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <ActivityBlock title="Recent bookings" href="/bookings">
              {recentBookings.length === 0 ? (
                <EmptyRow text="No recent bookings." />
              ) : (
                recentBookings.slice(0, 4).map((b) => (
                  <li
                    key={b.id}
                    className="border-b border-border-subtle last:border-0"
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
                        {b.paymentStatus ? (
                          <p className="mt-0.5 text-[11px] text-text-faint">
                            Payment · {statusLabel(b.paymentStatus)}
                          </p>
                        ) : null}
                      </div>
                      <Badge tone={statusTone(b.status)}>
                        {statusLabel(b.status)}
                      </Badge>
                    </ModuleFeedRow>
                  </li>
                ))
              )}
            </ActivityBlock>

            <ActivityBlock title="Recent payments" href="/payments">
              {recentPayments.length === 0 ? (
                <EmptyRow text="No recent payments." />
              ) : (
                recentPayments.slice(0, 4).map((p) => (
                  <li
                    key={p.id}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <ModuleFeedRow
                      onClick={
                        p.bookingId
                          ? () => router.push(`/bookings/${p.bookingId}`)
                          : undefined
                      }
                      className="grid-cols-[1fr_auto] items-center gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="tabular-nums text-[14px] font-semibold text-ink">
                            {p.amount}
                          </p>
                          <HostedByBadge value={p.hostedBy} short />
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-text-faint">
                          {"guest" in p ? p.guest : "—"} · {p.venue}
                          {p.when ? ` · ${p.when}` : ""}
                        </p>
                      </div>
                      <Badge tone={statusTone(p.status)}>
                        {statusLabel(p.status)}
                      </Badge>
                    </ModuleFeedRow>
                  </li>
                ))
              )}
            </ActivityBlock>
          </div>
        )}
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-snug text-text-faint">{label}</dt>
      <dd className="mt-1 text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-ink sm:text-[20px]">
        {value}
      </dd>
    </div>
  );
}

function ActivityBlock({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-text-muted">{title}</h3>
        <Link
          href={href}
          className="text-[12px] font-semibold text-accent hover:underline"
        >
          View all
        </Link>
      </div>
      <ModuleFeed>{children}</ModuleFeed>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <li className="px-5 py-8 text-center text-[13px] text-text-muted">
      {text}
    </li>
  );
}
