"use client";

import { useMemo, useState } from "react";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import { listGuests } from "@/lib/api/guests";
import { statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { MOCK_GUESTS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

export default function GuestsPage() {
  const { mockMode } = useAuth();
  const [q, setQ] = useState("");

  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listGuests(token);
      return res.guests.map((g) => ({
        id: g.id,
        name: g.name,
        phone: g.phone || "—",
        email: g.email || "—",
        bookings: g.bookings,
        lastVenue: g.lastVenue || "—",
        status: g.status,
      }));
    },
  );

  const rows = useMemo(() => {
    const source = mockMode ? MOCK_GUESTS : (data ?? []);
    const needle = q.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((g) =>
      [g.name, g.phone, g.email, g.lastVenue]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [q, mockMode, data]);

  return (
    <div>
      <PageHeader
        title="Guests"
        description="People who book nights across the NYTO network."
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <div className="mb-4 max-w-sm">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, email…"
          aria-label="Search guests"
        />
      </div>

      {loading && !mockMode && !data ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            !mockMode && (data?.length ?? 0) === 0 && !q.trim()
              ? "No guests yet"
              : "No guests found"
          }
          description={
            !mockMode && (data?.length ?? 0) === 0 && !q.trim()
              ? "Guests appear after people create accounts or book nights."
              : "Try a different search."
          }
        />
      ) : (
        <div className="nyto-panel overflow-hidden">
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Contact</th>
                  <th>Bookings</th>
                  <th>Last venue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id}>
                    <td className="font-medium text-ink">{g.name}</td>
                    <td>
                      <div className="text-text-muted">{g.phone}</div>
                      <div className="text-[13px] text-text-faint">{g.email}</div>
                    </td>
                    <td className="tabular-nums">{g.bookings}</td>
                    <td className="text-text-muted">{g.lastVenue}</td>
                    <td>
                      <Badge tone={statusTone(g.status)}>
                        {statusLabel(g.status)}
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
