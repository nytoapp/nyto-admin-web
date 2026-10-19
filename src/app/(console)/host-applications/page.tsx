"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import {
  ModuleFilters,
  ModuleHero,
  ModulePill,
} from "@/components/ui/ModuleShell";
import {
  EmptyState,
  ErrorBanner,
  Skeleton,
} from "@/components/ui/Page";
import { ApiError } from "@/lib/api/client";
import {
  approveHostApplication,
  listHostApplications,
  rejectHostApplication,
  type HostApplication,
} from "@/lib/api/hosts";
import { listVenues } from "@/lib/api/venues";
import { statusLabel } from "@/lib/format";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { hostApplicationKpis } from "@/lib/kpi";
import { MOCK_HOST_APPS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

function parseHostStatus(raw: string | null): StatusFilter {
  if (
    raw === "PENDING" ||
    raw === "APPROVED" ||
    raw === "REJECTED" ||
    raw === "ALL"
  ) {
    return raw;
  }
  return "PENDING";
}

type HostRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  venue: string;
  city: string;
  area: string;
  address: string;
  notes: string;
  businessDetails: string;
  venueType: string;
  status: string;
  linkedVenueId: string | null;
  rejectionReason: string;
};

function mapHost(a: HostApplication): HostRow {
  return {
    id: a.id,
    name: a.contactName || a.user?.fullName || a.user?.firstName || "Applicant",
    phone: a.contactPhone || a.user?.phone || "—",
    email: a.contactEmail || a.user?.email || "—",
    venue: a.venueName || a.venue?.name || "—",
    city: a.city || a.venue?.city || "—",
    area: a.area || a.venue?.area || "—",
    address: a.address || "—",
    notes: a.notes || "",
    businessDetails: a.businessDetails || "",
    venueType: a.venueType || "",
    status: a.status,
    linkedVenueId: a.venue?.id || a.venueId || null,
    rejectionReason: a.rejectionReason || "",
  };
}

export default function HostApplicationsPage() {
  const searchParams = useSearchParams();
  const { mockMode, getToken } = useAuth();
  const [status, setStatus] = useState<StatusFilter>(() =>
    parseHostStatus(searchParams.get("status")),
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setStatus(parseHostStatus(searchParams.get("status")));
  }, [searchParams]);
  const [localRows, setLocalRows] = useState<HostRow[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkVenueId, setLinkVenueId] = useState<Record<string, string>>({});

  /** Always load full ledger so KPI cards stay accurate across tabs. */
  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listHostApplications(token, "ALL");
      return res.applications.map(mapHost);
    },
  );

  const venues = useAdminResource(!mockMode, async (token) => {
    const res = await listVenues(token);
    return res.venues.map((v) => ({
      id: v.id,
      label: `${v.name}${v.area ? ` · ${v.area}` : ""}`,
    }));
  });

  const rows = useMemo(() => {
    if (localRows) return localRows;
    if (mockMode) {
      return MOCK_HOST_APPS.map((r) => ({
        ...r,
        area: "—",
        address: "—",
        notes: "",
        businessDetails: "",
        venueType: "",
        linkedVenueId: null,
        rejectionReason: "",
      }));
    }
    return data ?? [];
  }, [localRows, mockMode, data]);

  const filtered = useMemo(() => {
    if (status === "ALL") return rows;
    return rows.filter((r) => r.status === status);
  }, [rows, status]);

  async function onApprove(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      if (mockMode) {
        setLocalRows(
          rows.map((r) => (r.id === id ? { ...r, status: "APPROVED" } : r)),
        );
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      const venueId = linkVenueId[id]?.trim() || undefined;
      await approveHostApplication(token, id, venueId);
      setLocalRows(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not approve application.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(id: string) {
    const reason = window.prompt("Optional reject reason") ?? "";
    setBusyId(id);
    setActionError(null);
    try {
      if (mockMode) {
        setLocalRows(
          rows.map((r) => (r.id === id ? { ...r, status: "REJECTED" } : r)),
        );
        return;
      }
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      await rejectHostApplication(token, id, reason || undefined);
      setLocalRows(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not reject application.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const kpi = hostApplicationKpis(rows);

  return (
    <div className="nyto-fade">
      <ModuleHero
        eyebrow="Network"
        title="Host applications"
        description="Venue-organized onboarding queue. Approve creates a Venue-organized venue and owner — not counted as a venue until that succeeds."
        stats={[
          {
            label: "Awaiting review",
            value: String(kpi.awaitingReview),
            hint: "PENDING · actionable work",
          },
          {
            label: "Approved",
            value: String(kpi.approved),
            soft: true,
            hint: "Applications · not venue count",
          },
          {
            label: "Rejected",
            value: String(kpi.rejected),
            soft: true,
            hint: "status = REJECTED",
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
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex flex-wrap gap-1"
            role="tablist"
            aria-label="Application status"
          >
            {(
              [
                ["PENDING", "Awaiting review"],
                ["APPROVED", "Approved"],
                ["REJECTED", "Rejected"],
                ["ALL", "All"],
              ] as const
            ).map(([id, label]) => (
              <ModulePill
                key={id}
                active={status === id}
                onClick={() => setStatus(id)}
                label={label}
                count={
                  id === "ALL"
                    ? kpi.totalLoaded
                    : id === "PENDING"
                      ? kpi.awaitingReview
                      : id === "APPROVED"
                        ? kpi.approved
                        : kpi.rejected
                }
              />
            ))}
          </div>
          <p className="text-[13px] tabular-nums text-text-faint lg:ml-auto">
            {filtered.length}
            <span className="text-text-faint/70"> applications in view</span>
          </p>
        </div>
        <p className="mt-2.5 text-[12px] text-text-faint">
          Approve creates a partner venue via API. Venue count on Venues only
          updates after approval succeeds — then they publish in the venue
          portal.
        </p>
      </ModuleFilters>

      {loading && !mockMode && !data ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No applications"
          description={
            status === "PENDING"
              ? "Nothing waiting for review right now."
              : "No applications in this filter."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => {
            const open = expandedId === r.id;
            return (
              <article
                key={r.id}
                className="nyto-step-in overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]"
                style={{ animationDelay: `${120 + Math.min(i, 8) * 40}ms` }}
              >
                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
                        {r.name}
                      </h3>
                      <Badge tone={statusTone(r.status)}>
                        {statusLabel(r.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[14px] text-text-muted">
                      {r.venue}
                      {r.area !== "—" ? ` · ${r.area}` : ""} · {r.city}
                    </p>
                    <p className="mt-1 text-[13px] text-text-faint">
                      {r.phone} · {r.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setExpandedId((cur) => (cur === r.id ? null : r.id))
                      }
                    >
                      {open ? "Hide details" : "Details"}
                    </Button>
                    {r.linkedVenueId ? (
                      <Link href={`/venues/${r.linkedVenueId}`}>
                        <Button variant="ghost">Open venue</Button>
                      </Link>
                    ) : null}
                    {r.status === "PENDING" ? (
                      <>
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
                      </>
                    ) : null}
                  </div>
                </div>

                {open ? (
                  <div className="border-t border-border-subtle bg-bg/40 px-4 py-4 sm:px-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
                          Address
                        </p>
                        <p className="mt-1 text-[14px] text-text">{r.address}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
                          Venue type
                        </p>
                        <p className="mt-1 text-[14px] text-text">
                          {r.venueType || "—"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
                          Business details
                        </p>
                        <p className="mt-1 text-[14px] text-text">
                          {r.businessDetails || "—"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
                          Notes
                        </p>
                        <p className="mt-1 text-[14px] text-text">
                          {r.notes || "—"}
                        </p>
                      </div>
                      {r.rejectionReason ? (
                        <div className="sm:col-span-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
                            Rejection reason
                          </p>
                          <p className="mt-1 text-[14px] text-danger">
                            {r.rejectionReason}
                          </p>
                        </div>
                      ) : null}
                      {r.status === "PENDING" && !mockMode ? (
                        <div className="sm:col-span-2">
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
                            Link existing venue (optional)
                          </p>
                          <Select
                            value={linkVenueId[r.id] ?? ""}
                            onChange={(e) =>
                              setLinkVenueId((prev) => ({
                                ...prev,
                                [r.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Create new venue from application</option>
                            {(venues.data ?? []).map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
