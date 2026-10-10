"use client";

import { useMemo, useState } from "react";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatCard,
} from "@/components/ui/Page";
import { listPayments } from "@/lib/api/bookings";
import { formatMoneyInr, statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapPaymentRow, type PaymentRow } from "@/lib/mappers";
import { MOCK_PAYMENTS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

type StatusFilter = "all" | "CAPTURED" | "PENDING" | "FAILED" | "REFUNDED";

export default function PaymentsPage() {
  const { mockMode } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listPayments(token);
      return res.payments.map(mapPaymentRow);
    },
  );

  const source = useMemo<PaymentRow[]>(() => {
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
      }));
    }
    return data ?? [];
  }, [mockMode, data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return source.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!needle) return true;
      return [p.guest, p.venue, p.amount, p.when, p.providerRef, p.method]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, status, source]);

  const capturedTotal = source
    .filter((p) => p.status === "CAPTURED")
    .reduce((sum, p) => sum + p.amountValue, 0);
  const pendingTotal = source
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.amountValue, 0);
  const refundedTotal = source
    .filter((p) => p.status === "REFUNDED")
    .reduce((sum, p) => sum + p.amountValue, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Payments"
        description="Ledger of guest checkout — pending, captured, and refunded."
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rows" value={String(source.length)} />
        <StatCard label="Captured" value={formatMoneyInr(capturedTotal)} />
        <StatCard label="Pending" value={formatMoneyInr(pendingTotal)} />
        <StatCard label="Refunded" value={formatMoneyInr(refundedTotal)} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guest, venue, ref…"
            aria-label="Search payments"
          />
        </div>
        <div className="flex flex-wrap rounded-xl border border-border bg-bg-elevated p-0.5">
          {(
            [
              ["all", "All"],
              ["CAPTURED", "Captured"],
              ["PENDING", "Pending"],
              ["REFUNDED", "Refunded"],
              ["FAILED", "Failed"],
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
          title={source.length === 0 ? "No payments yet" : "No matching payments"}
          description={
            source.length === 0
              ? "Payments appear when a guest starts or completes checkout."
              : "Try another search or status filter."
          }
        />
      ) : (
        <div className="nyto-panel overflow-hidden">
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Guest</th>
                  <th>Venue</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Ref</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="text-text-muted">{p.when}</td>
                    <td className="font-medium text-ink">{p.guest}</td>
                    <td className="text-text-muted">{p.venue}</td>
                    <td className="font-medium tabular-nums text-ink">
                      {p.amount}
                    </td>
                    <td className="text-text-muted">
                      {p.method ? statusLabel(p.method) : "—"}
                    </td>
                    <td className="max-w-[140px] truncate font-mono text-[12px] text-text-faint">
                      {p.providerRef || "—"}
                    </td>
                    <td>
                      <Badge tone={statusTone(p.status)}>
                        {statusLabel(p.status)}
                      </Badge>
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
