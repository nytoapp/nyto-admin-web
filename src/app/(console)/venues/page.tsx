"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import {
  HostedByBadge,
  HostedByFilterBar,
} from "@/components/ui/HostedBy";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@/components/ui/Page";
import { listVenues } from "@/lib/api/venues";
import type { HostedByFilter } from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { mapVenueRow, type VenueRow } from "@/lib/mappers";
import { MOCK_VENUES } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

export default function VenuesPage() {
  const { mockMode } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [hostedBy, setHostedBy] = useState<HostedByFilter>("all");

  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listVenues(token);
      return res.venues.map(mapVenueRow);
    },
  );

  const filtered = useMemo(() => {
    const source: VenueRow[] = mockMode
      ? MOCK_VENUES.map((v) => ({
          id: v.id,
          name: v.name,
          area: v.area,
          city: v.city,
          address: v.address,
          tables: v.tables,
          staff: v.staff,
          active: v.active,
          hostedBy: v.hostedBy,
        }))
      : (data ?? []);
    const needle = q.trim().toLowerCase();
    return source.filter((v) => {
      if (status === "active" && !v.active) return false;
      if (status === "inactive" && v.active) return false;
      if (hostedBy === "NYTO" && v.hostedBy === "PARTNER") return false;
      if (hostedBy === "PARTNER" && v.hostedBy === "NYTO") return false;
      if (!needle) return true;
      return [v.name, v.area, v.city, v.address]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, status, hostedBy, mockMode, data]);

  return (
    <div>
      <PageHeader
        title="Venues"
        description="Places hosting NYTO curated and partner nights."
        actions={
          <Link href="/venues/new">
            <Button>+ Add venue</Button>
          </Link>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="min-w-0 flex-1 sm:max-w-sm">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, area, city…"
              aria-label="Search venues"
            />
          </div>
          <HostedByFilterBar value={hostedBy} onChange={setHostedBy} />
        </div>
        <div className="flex rounded-xl border border-border bg-bg-elevated p-0.5">
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

      {loading && !mockMode ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            status === "inactive"
              ? "No inactive venues"
              : status === "active"
                ? "No active venues"
                : "No matching venues"
          }
          description={
            status === "inactive"
              ? "Disabled venues will show up here."
              : "Try a different search or filter."
          }
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="nyto-panel overflow-hidden">
          <div className="nyto-table-wrap">
            <table className="nyto-table">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Location</th>
                  <th>Organised by</th>
                  <th>Nights</th>
                  <th>Contacts</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium text-ink">{v.name}</td>
                    <td className="text-text-muted">
                      {v.area} · {v.city}
                    </td>
                    <td>
                      <HostedByBadge value={v.hostedBy} />
                    </td>
                    <td className="tabular-nums text-text-muted">{v.tables}</td>
                    <td className="tabular-nums text-text-muted">{v.staff}</td>
                    <td>
                      <Badge tone={v.active ? "success" : "neutral"}>
                        {v.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/venues/${v.id}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        Open
                      </Link>
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
