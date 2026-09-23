"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveHostApplication,
  listHostApplications,
  rejectHostApplication,
  type HostApplication,
} from "@/lib/api/hosts";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import { statusLabel } from "@/lib/format";

export default function HostApplicationsPage() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState("PENDING");
  const [rows, setRows] = useState<HostApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await listHostApplications(token, status);
      setRows(res.applications);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load applications.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onApprove(id: string) {
    setBusyId(id);
    try {
      const token = await getToken();
      if (!token) return;
      await approveHostApplication(token, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approve failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(id: string) {
    const reason = window.prompt("Optional reject reason") ?? undefined;
    setBusyId(id);
    try {
      const token = await getToken();
      if (!token) return;
      await rejectHostApplication(token, id, reason || undefined);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reject failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Host applications"
        description="People asking to run venue operations. Approve to grant staff access."
      />

      <div className="mb-4 max-w-xs">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="ALL">All</option>
        </Select>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No applications"
          description="When someone applies to host from the app, they show up here for review."
        />
      ) : (
        <div className="nyto-panel">
          <table className="nyto-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Venue intent</th>
                <th>User</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-medium">{r.contactName}</div>
                    <div className="text-[12px] text-text-faint">
                      {r.contactPhone || "—"}
                    </div>
                  </td>
                  <td className="text-text-muted">
                    {r.venueName || r.venue?.name || "—"}
                    {r.city || r.venue?.city
                      ? ` · ${r.city || r.venue?.city}`
                      : ""}
                  </td>
                  <td className="text-text-muted">
                    {r.user?.email || r.user?.phone || r.user?.id || "—"}
                  </td>
                  <td>
                    <Badge tone={statusTone(r.status)}>
                      {statusLabel(r.status)}
                    </Badge>
                  </td>
                  <td className="text-right">
                    {r.status === "PENDING" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          disabled={busyId === r.id}
                          onClick={() => void onReject(r.id)}
                        >
                          Reject
                        </Button>
                        <Button
                          disabled={busyId === r.id}
                          onClick={() => void onApprove(r.id)}
                        >
                          {busyId === r.id ? "…" : "Approve"}
                        </Button>
                      </div>
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
