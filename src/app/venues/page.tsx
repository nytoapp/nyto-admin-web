"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listVenues } from "@/lib/api/venues";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import type { Venue } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";

export default function VenuesPage() {
  const { getToken } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await listVenues(token);
      setVenues(res.venues);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load venues.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return venues.filter((v) => {
      if (status === "active" && !v.isActive) return false;
      if (status === "inactive" && v.isActive) return false;
      if (!needle) return true;
      return [v.name, v.city, v.area, v.address]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle));
    });
  }, [venues, q, status]);

  return (
    <div>
      <PageHeader
        title="Venues"
        description="Places where NYTO experiences happen."
        actions={
          <Link href="/venues/new">
            <Button>+ Add venue</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[220px] max-w-sm flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, area, city…"
            aria-label="Search venues"
          />
        </div>
        <div className="flex rounded-lg border border-border bg-bg-elevated p-0.5">
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["inactive", "Inactive"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatus(id)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
                status === id
                  ? "bg-bg-soft text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <Skeleton className="h-72" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={venues.length === 0 ? "No venues yet" : "No matching venues"}
          description={
            venues.length === 0
              ? "Create your first venue to start publishing NYTO nights."
              : "Try a different search or filter."
          }
          action={
            venues.length === 0 ? (
              <Link href="/venues/new">
                <Button>Create venue</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={() => { setQ(""); setStatus("all"); }}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="nyto-panel">
          <table className="nyto-table">
            <thead>
              <tr>
                <th>Venue</th>
                <th>Location</th>
                <th>Tables</th>
                <th>Staff</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium">{v.name}</td>
                  <td className="text-text-muted">
                    {[v.area, v.city].filter(Boolean).join(" · ")}
                  </td>
                  <td className="tabular-nums text-text-muted">
                    {v._count?.tables ?? 0}
                  </td>
                  <td className="tabular-nums text-text-muted">
                    {v._count?.staff ?? 0}
                  </td>
                  <td>
                    <Badge tone={v.isActive ? "success" : "neutral"}>
                      {v.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/venues/${v.id}`}
                      className="font-semibold text-accent-soft hover:underline"
                    >
                      Open
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
