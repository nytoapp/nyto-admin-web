"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { formatMoneyInr, paymentMethodLabel, statusLabel } from "@/lib/format";
import type { HostedByFilter } from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapPaymentRow, type PaymentRow } from "@/lib/mappers";
import { MOCK_PAYMENTS } from "@/lib/mock/data";
import {
  collectPaymentMethodFilterOptions,
  filterPaymentRows,
  type PaymentMethodFilter,
} from "@/lib/payment-method";
import { useAuth } from "@/providers/auth-provider";

type StatusFilter = "all" | "CAPTURED" | "PENDING" | "FAILED" | "REFUNDED";

function parsePaymentStatus(raw: string | null): StatusFilter {
  if (
    raw === "CAPTURED" ||
    raw === "PENDING" ||
    raw === "FAILED" ||
    raw === "REFUNDED"
  ) {
    return raw;
  }
  return "all";
}

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const { mockMode, getToken } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>(() =>
    parsePaymentStatus(searchParams.get("status")),
  );
  const [hostedBy, setHostedBy] = useState<HostedByFilter>("all");
  const [method, setMethod] = useState<PaymentMethodFilter>("all");

  useEffect(() => {
    setStatus(parsePaymentStatus(searchParams.get("status")));
  }, [searchParams]);
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
        method: p.method ?? null,
        providerRef: null,
        bookingId: null,
        hostedBy: p.hostedBy,
      }));
    }
    return data ?? [];
  }, [mockMode, data, localRows]);

  const methodOptions = useMemo(
    () => collectPaymentMethodFilterOptions(source),
    [source],
  );

  const filtered = useMemo(
    () =>
      filterPaymentRows(source, {
        q,
        status,
        hostedBy,
        method,
      }),
    [q, status, hostedBy, method, source],
  );

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
        description="Payments in current feed · amounts in INR by payment status."
        stats={[
          {
            label: "Successfully captured",
            value:
              loading && !mockMode && !data
                ? "—"
                : formatMoneyInr(capturedTotal),
          },
          {
            label: "Pending amount",
            value:
              loading && !mockMode && !data
                ? "—"
                : formatMoneyInr(pendingTotal),
            soft: true,
          },
          {
            label: "Refunded amount",
            value:
              loading && !mockMode && !data
                ? "—"
                : formatMoneyInr(refundedTotal),
            soft: true,
          },
          {
            label: "Failed payments",
            value:
              loading && !mockMode && !data
                ? "—"
                : String(statusCounts.FAILED ?? 0),
            soft: true,
          },
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
          <div className="min-w-0 flex-1 lg:max-w-[280px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search guest, venue, ref…"
              aria-label="Search payments"
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-text-muted">
            <span className="shrink-0 font-semibold uppercase tracking-[0.1em] text-text-faint">
              Method
            </span>
            <select
              className="h-10 min-w-[148px] rounded-xl border border-border bg-bg px-3 text-[13px] text-ink"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              aria-label="Payment method"
            >
              <option value="all">All methods</option>
              {methodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {method !== "all" ? (
              <button
                type="button"
                onClick={() => setMethod("all")}
                className="text-[12px] font-semibold text-accent hover:underline"
              >
                Reset
              </button>
            ) : null}
          </label>
          <div
            className="flex rounded-xl border border-border bg-bg p-0.5"
            role="group"
            aria-label="Organized by"
          >
            {(
              [
                ["all", "All"],
                ["NYTO", "NYTO-organized"],
                ["PARTNER", "Venue-organized"],
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
            <span className="text-text-faint/70">
              {" "}
              payment records shown / {source.length} in ledger
            </span>
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
              : "Try another search, status, or method filter."
          }
        />
      ) : (
        <ModuleFeed
          headers={
            <div className="hidden border-b border-border-subtle px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_88px_100px_100px_28px] lg:gap-3">
              <span>Guest</span>
              <span>Venue</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Method</span>
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
              <ModuleFeedRow className="lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_88px_100px_100px_28px] lg:items-center lg:gap-3">
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
                    {p.bookingId ? (
                      <Link
                        href={`/bookings/${p.bookingId}`}
                        className="font-semibold text-accent hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Booking
                      </Link>
                    ) : (
                      "No booking link"
                    )}
                  </p>
                </div>
                <p className="text-[14px] font-semibold tabular-nums text-ink lg:text-right">
                  {p.amount}
                </p>
                <p className="text-[12px] text-text-muted lg:text-right">
                  {paymentMethodLabel(p.method)}
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
