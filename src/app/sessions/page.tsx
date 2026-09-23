"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listVenueTables, listVenues } from "@/lib/api/venues";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import type { AdminTable, Venue } from "@/lib/types";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import {
  formatMoneyInr,
  formatSeats,
  formatWhen,
  statusLabel,
} from "@/lib/format";

type Row = AdminTable & { venueName: string; venueId: string };

export default function SessionsPage() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const venuesRes = await listVenues(token);
      const tablesNested = await Promise.all(
        venuesRes.venues.map(async (v: Venue) => {
          const t = await listVenueTables(token, v.id);
          return t.tables.map((table) => ({
            ...table,
            venueName: v.name,
            venueId: v.id,
          }));
        }),
      );
      const flat = tablesNested.flat().sort((a, b) => {
        return (
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        );
      });
      setRows(flat);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load sessions.",
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
        title="Sessions"
        description="Scheduled nights across all venues. Create new sessions from a venue page."
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Open a venue and create a session to publish a night to the app."
          action={
            <Link href="/venues">
              <Button>Go to venues</Button>
            </Link>
          }
        />
      ) : (
        <div className="nyto-panel">
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
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{formatWhen(r.startsAt)}</td>
                  <td className="text-text-muted">{r.venueName}</td>
                  <td className="tabular-nums">{formatMoneyInr(r.seatPrice)}</td>
                  <td className="text-text-muted">
                    {formatSeats(r.seatsLeft, r.capacity)}
                  </td>
                  <td>
                    <Badge tone={statusTone(r.status)}>
                      {statusLabel(r.status)}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/venues/${r.venueId}`}
                      className="font-semibold text-accent-soft hover:underline"
                    >
                      Venue
                    </Link>
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
