"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { HostedByBadge } from "@/components/ui/HostedBy";
import {
  ModuleFeed,
  ModuleFeedRow,
  ModuleFilters,
  ModuleHero,
  ModulePill,
} from "@/components/ui/ModuleShell";
import {
  EmptyState,
  ErrorBanner,
  Skeleton,
} from "@/components/ui/Page";
import { listPayments, refundPayment } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { confirmDestructive } from "@/lib/console-settings";
import { formatMoneyInr, statusLabel } from "@/lib/format";
import type { HostedByFilter } from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapPaymentRow, type PaymentRow } from "@/lib/mappers";
import { MOCK_PAYMENTS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

type StatusFilter = "all" | "CAPTURED" | "PENDING" | "FAILED" | "REFUNDED";

export default function PaymentsPage() {
  const { mockMode, getToken } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [hostedBy, setHostedBy] = useState<HostedByFilter>("all");
  const [localRows, setLocalRows] = useState<PaymentRow[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listPayments(token);
      return res.payments.map(mapPaymentRow);
    },
  );

  const source = useMemo<PaymentRow[]>(() => {
    if (localRows) return localRows;
    if (mockMode) {
      return MOCK_PAYMENTS.map((p) => ({
        id: p.id,
        when: p.when,
        guest: p.guest,
        amount: p.amount,
        amountValue: 0,
        venue: p.venue,
        status: p.status === "PENDING_PAYMENT" ? "PENDING" : p.status,
        method: null,
        providerRef: null,
        bookingId: null,
        hostedBy: p.hostedBy,
      }));
    }
    return data ?? [];
  }, [mockMode, data, localRows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return source.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (hostedBy !== "all" && p.hostedBy !== hostedBy) return false;
      if (!needle) return true;
      return [p.guest, p.venue, p.amount, p.when, p.providerRef, p.method]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, status, hostedBy, source]);

  const capturedTotal = source
    .filter((p) => p.status === "CAPTURED")
    .reduce((sum, p) => sum + p.amountValue, 0);
  const pendingTotal = source
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.amountValue, 0);
  const refundedTotal = source
    .filter((p) => p.status === "REFUNDED")
    .reduce((sum, p) => sum + p.amountValue, 0);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: source.length };
    for (const id of ["CAPTURED", "PENDING", "REFUNDED", "FAILED"] as const) {
      counts[id] = source.filter((p) => p.status === id).length;
    }
    return counts;
  }, [source]);

  async function onRefund(id: string) {
    if (
      !confirmDestructive(
        "Refund this payment? The linked booking will be cancelled if still open.",
      )
    ) {
      return;
    }
    const reason =
      window.prompt("Refund reason (optional)")?.trim() || undefined;
    setActionError(null);
    setRefundingId(id);
    try {
      if (mockMode) {
        setLocalRows(
          source.map((p) =>
            p.id === id ? { ...p, status: "REFUNDED" } : p,
          ),
        );
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await refundPayment(token, id, reason);
      setLocalRows(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not refund payment.",
      );
    } finally {
      setRefundingId(null);
    }
  }

  return (
    <div className="nyto-fade">
      <ModuleHero
        eyebrow="Operations"
        title="Payments"
        description="Checkout ledger across NYTO curated and partner nights — capture, pending, and refunds."
        stats={[
          { label: "In ledger", value: String(source.length) },
          { label: "Captured", value: formatMoneyInr(capturedTotal), soft: true },
          { label: "Pending", value: formatMoneyInr(pendingTotal), soft: true },
          { label: "Refunded", value: formatMoneyInr(refundedTotal), soft: true },
        ]}
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}
      {actionError ? (
        <ErrorBanner
          message={actionError}
          onRetry={() => setActionError(null)}
        />
      ) : null}

      <ModuleFilters>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 lg:max-w-[300px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search guest, venue, ref…"
              aria-label="Search payments"
            />
          </div>
          <div
            className="flex rounded-xl border border-border bg-bg p-0.5"
            role="group"
            aria-label="Organised by"
          >
            {(
              [
                ["all", "All"],
                ["NYTO", "NYTO"],
                ["PARTNER", "Partner"],
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
          <p className="text-[13px] tabular-nums text-text-faint lg:ml-auto">
            {filtered.length}
            <span className="text-text-faint/70"> / {source.length}</span>
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1 border-t border-border-subtle pt-3">
          {(
            [
              ["all", "All"],
              ["CAPTURED", "Captured"],
              ["PENDING", "Pending"],
              ["REFUNDED", "Refunded"],
              ["FAILED", "Failed"],
            ] as const
          ).map(([id, label]) => (
            <ModulePill
              key={id}
              active={status === id}
              onClick={() => setStatus(id)}
              label={label}
              count={statusCounts[id] ?? 0}
            />
          ))}
        </div>
      </ModuleFilters>

      {loading && !mockMode && !data ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <Skeleton className="h-[72px] rounded-none" />
          <Skeleton className="h-[72px] rounded-none opacity-70" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={source.length === 0 ? "No payments yet" : "No matching payments"}
          description={
            source.length === 0
              ? "Payments appear when a guest starts or completes checkout."
              : "Try another search or status filter."
          }
        />
      ) : (
        <ModuleFeed
          headers={
            <div className="hidden border-b border-border-subtle px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_100px_120px_28px] lg:gap-3">
              <span>Guest</span>
              <span>Venue</span>
              <span className="text-right">Amount</span>
              <span className="text-right">State</span>
              <span />
            </div>
          }
        >
          {filtered.map((p, i) => (
            <li
              key={p.id}
              className="nyto-step-in border-b border-border-subtle last:border-0"
              style={{ animationDelay: `${120 + Math.min(i, 10) * 40}ms` }}
            >
              <ModuleFeedRow className="lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_100px_120px_28px] lg:items-center lg:gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
                      {p.guest}
                    </p>
                    <HostedByBadge value={p.hostedBy} short />
                  </div>
                  <p className="mt-1 truncate text-[12px] text-text-faint">
                    {p.when}
                    {p.providerRef ? (
                      <span className="font-mono"> · {p.providerRef}</span>
                    ) : null}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-text">
                    {p.venue}
                  </p>
                  <p className="mt-0.5 text-[12px] text-text-faint">
                    {p.method ? statusLabel(p.method) : "—"}
                    {p.bookingId ? (
                      <>
                        {" · "}
                        <Link
                          href={`/bookings/${p.bookingId}`}
                          className="font-semibold text-accent hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Booking
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <p className="text-[14px] font-semibold tabular-nums text-ink lg:text-right">
                  {p.amount}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                  <Badge tone={statusTone(p.status)}>
                    {statusLabel(p.status)}
                  </Badge>
                  {p.status === "CAPTURED" ? (
                    <button
                      type="button"
                      disabled={refundingId === p.id}
                      onClick={() => void onRefund(p.id)}
                      className="text-[12px] font-semibold text-text-muted hover:text-ink disabled:opacity-50"
                    >
                      {refundingId === p.id ? "…" : "Refund"}
                    </button>
                  ) : null}
                </div>
                <span
                  className="nyto-bookings-arrow hidden text-[16px] text-text-faint lg:block lg:text-right"
                  aria-hidden
                >
                  →
                </span>
              </ModuleFeedRow>
            </li>
          ))}
        </ModuleFeed>
      )}
    </div>
  );
}
