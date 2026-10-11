"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import { ApiError } from "@/lib/api/client";
import { listTableBookings, listTables } from "@/lib/api/tables";
import { cancelTable } from "@/lib/api/venues";
import { formatMoneyInr, guestName, statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapBookingRow, mapSessionRow, type SessionRow } from "@/lib/mappers";
import { MOCK_NETWORK_SESSIONS } from "@/lib/mock/data";
import type { AdminBooking } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

type StatusFilter =
  | "all"
  | "OPEN"
  | "FULL"
  | "MATCHING"
  | "CANCELLED";

export default function SessionsPage() {
  const { mockMode, getToken } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [localRows, setLocalRows] = useState<SessionRow[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rosterId, setRosterId] = useState<string | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterBookings, setRosterBookings] = useState<AdminBooking[]>([]);
  const [rosterMeta, setRosterMeta] = useState<{
    when: string;
    venue: string;
    experience: string;
  } | null>(null);

  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listTables(token);
      return res.tables.map(mapSessionRow);
    },
  );

  const rows = useMemo(() => {
    if (localRows) return localRows;
    if (mockMode) {
      return MOCK_NETWORK_SESSIONS.map((r) => ({
        id: r.id,
        when: r.when,
        venue: r.venue,
        venueId: r.venueId,
        price: r.price,
        seats: r.seats,
        status: r.status,
        experience: "—",
      }));
    }
    return data ?? [];
  }, [localRows, mockMode, data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!needle) return true;
      return [r.when, r.venue, r.price, r.experience]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, rows, status]);

  async function cancelSession(id: string) {
    if (
      !window.confirm(
        "Cancel this session? Open bookings will be cancelled and captured payments refunded.",
      )
    ) {
      return;
    }
    const reason =
      window.prompt("Cancel reason (optional)")?.trim() || undefined;
    setActionError(null);
    if (mockMode) {
      setLocalRows(
        rows.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r)),
      );
      return;
    }
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await cancelTable(token, id, reason);
      setLocalRows(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not cancel session.",
      );
    }
  }

  async function openRoster(session: SessionRow) {
    setRosterId(session.id);
    setRosterMeta({
      when: session.when,
      venue: session.venue,
      experience: session.experience,
    });
    setRosterError(null);
    setRosterBookings([]);
    if (mockMode) {
      setRosterBookings([]);
      return;
    }
    setRosterLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      const res = await listTableBookings(token, session.id);
      setRosterBookings(res.bookings);
    } catch (err) {
      setRosterError(
        err instanceof Error ? err.message : "Could not load guest roster.",
      );
    } finally {
      setRosterLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Sessions"
        description="Scheduled nights across all venues. Open a roster to see who’s booked."
        actions={
          <Link href="/venues">
            <Button variant="secondary">Browse venues</Button>
          </Link>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}
      {actionError ? (
        <ErrorBanner
          message={actionError}
          onRetry={() => setActionError(null)}
        />
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search venue or date…"
            aria-label="Search sessions"
          />
        </div>
        <div className="flex flex-wrap rounded-xl border border-border bg-bg-elevated p-0.5">
          {(
            [
              ["all", "All"],
              ["OPEN", "Open"],
              ["FULL", "Full"],
              ["MATCHING", "Matching"],
              ["CANCELLED", "Cancelled"],
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {loading && !mockMode && !data ? (
            <Skeleton className="h-64" />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No sessions"
              description="Try another filter, or open a venue and create a night."
              action={
                <Link href="/venues">
                  <Button>Go to venues</Button>
                </Link>
              }
            />
          ) : (
            <div className="nyto-panel overflow-hidden">
              <div className="nyto-table-wrap">
                <table className="nyto-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Venue</th>
                      <th>Price</th>
                      <th>Seats</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r.id}
                        className={
                          rosterId === r.id ? "bg-[var(--accent-wash)]" : undefined
                        }
                      >
                        <td className="font-medium text-ink">{r.when}</td>
                        <td className="text-text-muted">{r.venue}</td>
                        <td className="tabular-nums">{r.price}</td>
                        <td className="text-text-muted">{r.seats}</td>
                        <td>
                          <Badge tone={statusTone(r.status)}>
                            {statusLabel(r.status)}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => void openRoster(r)}
                              className="text-[13px] font-semibold text-accent hover:underline"
                            >
                              Roster
                            </button>
                            {r.status !== "CANCELLED" ? (
                              <button
                                type="button"
                                onClick={() => void cancelSession(r.id)}
                                className="text-[13px] font-semibold text-danger hover:underline"
                              >
                                Cancel
                              </button>
                            ) : null}
                            <Link
                              href={`/venues/${r.venueId}`}
                              className="font-semibold text-accent hover:underline"
                            >
                              Venue
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className="nyto-panel h-fit overflow-hidden">
          <div className="border-b border-border-subtle px-4 py-3.5">
            <h2 className="text-[15px] font-semibold text-ink">Guest roster</h2>
            {rosterMeta ? (
              <p className="mt-1 text-[13px] text-text-muted">
                {rosterMeta.when} · {rosterMeta.venue}
                {rosterMeta.experience !== "—"
                  ? ` · ${rosterMeta.experience}`
                  : ""}
              </p>
            ) : (
              <p className="mt-1 text-[13px] text-text-muted">
                Select a session to see who’s booked.
              </p>
            )}
          </div>
          {!rosterId ? (
            <div className="px-4 py-8 text-[14px] text-text-faint">
              No session selected.
            </div>
          ) : rosterLoading ? (
            <div className="p-4">
              <Skeleton className="h-24" />
            </div>
          ) : rosterError ? (
            <div className="p-4">
              <ErrorBanner message={rosterError} />
            </div>
          ) : rosterBookings.length === 0 ? (
            <div className="px-4 py-8 text-[14px] text-text-muted">
              No bookings on this night yet.
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {rosterBookings.map((b) => {
                const row = mapBookingRow(b);
                return (
                  <li key={b.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{guestName(b.user)}</p>
                        <p className="text-[13px] text-text-faint">
                          {b.user?.phone || "—"} · {row.seats} seat
                          {row.seats === 1 ? "" : "s"}
                        </p>
                        {row.checkInCode ? (
                          <p className="mt-1 font-mono text-[12px] text-text-muted">
                            Check-in {row.checkInCode}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <Badge tone={statusTone(row.status)}>
                          {statusLabel(row.status)}
                        </Badge>
                        <p className="mt-1 text-[13px] tabular-nums text-text-muted">
                          {row.amount !== "—"
                            ? row.amount
                            : formatMoneyInr(b.payment?.amount)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
