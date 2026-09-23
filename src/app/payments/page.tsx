"use client";

import { useCallback, useEffect, useState } from "react";
import { listPayments } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import type { AdminPayment } from "@/lib/types";
import { Badge, statusTone } from "@/components/ui/Badge";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import {
  formatMoneyInr,
  formatWhen,
  guestName,
  statusLabel,
} from "@/lib/format";

export default function PaymentsPage() {
  const { getToken } = useAuth();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await listPayments(token);
      setPayments(res.payments);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load payments.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Payment activity from guest bookings."
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <Skeleton className="h-72" />
      ) : payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description="Successful or pending payments will show here once guests book."
        />
      ) : (
        <div className="nyto-panel">
          <table className="nyto-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Guest</th>
                <th>Venue</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-text-muted">{formatWhen(p.createdAt)}</td>
                  <td className="font-medium">
                    {guestName(p.booking?.user)}
                  </td>
                  <td className="text-text-muted">
                    {p.booking?.table?.venue?.name || "—"}
                  </td>
                  <td className="font-medium tabular-nums">
                    {formatMoneyInr(p.amountInr ?? p.amount)}
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
      )}
    </div>
  );
}
