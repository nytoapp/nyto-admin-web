"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { HostedByBadge } from "@/components/ui/HostedBy";
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
import { confirmDestructive } from "@/lib/console-settings";
import { statusLabel } from "@/lib/format";
import {
  resolveHostedBy,
  type HostedBy,
} from "@/lib/hosted-by";
import { useAdminResource } from "@/lib/hooks/useAdminResource";
import { hostApplicationKpis } from "@/lib/kpi";
import { MOCK_HOST_APPS } from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Requests & Approvals (host applications) list is loaded with status=ALL.
 * Backend may still cap the list — KPI scope is the loaded application set.
 */

type StatusFilter =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN"
  | "ALL";

function parseHostStatus(raw: string | null): StatusFilter {
  if (
    raw === "PENDING" ||
    raw === "APPROVED" ||
    raw === "REJECTED" ||
    raw === "WITHDRAWN" ||
    raw === "ALL"
  ) {
    return raw;
  }
  return "PENDING";
}

/** Host-app status labels — PENDING means awaiting review here. */
function applicationStatusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === "PENDING") return "Awaiting review";
  if (s === "WITHDRAWN") return "Withdrawn";
  return statusLabel(status);
}

function applicationStatusTone(
  status: string,
): ReturnType<typeof statusTone> {
  const s = status.toUpperCase();
  if (s === "PENDING") return "warning";
  if (s === "APPROVED") return "success";
  if (s === "REJECTED" || s === "WITHDRAWN") return "neutral";
  return statusTone(status);
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
  linkedVenueHostedBy: HostedBy | null;
  rejectionReason: string;
};

function mapHost(
  a: HostApplication,
  venueHostedByById: Map<string, HostedBy>,
): HostRow {
  const linkedVenueId = a.venue?.id || a.venueId || null;
  const fromNested = a.venue?.hostedBy
    ? resolveHostedBy(a.venue.hostedBy)
    : null;
  const fromLookup =
    linkedVenueId && venueHostedByById.has(linkedVenueId)
      ? venueHostedByById.get(linkedVenueId)!
      : null;

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
    linkedVenueId,
    linkedVenueHostedBy: fromNested ?? fromLookup,
    rejectionReason: a.rejectionReason || "",
  };
}

function emptyCopy(status: StatusFilter): { title: string; description: string } {
  switch (status) {
    case "PENDING":
      return {
        title: "No applications awaiting review.",
        description: "New venue host requests will appear here for approval.",
      };
    case "APPROVED":
      return {
        title: "No approved applications yet.",
        description: "Approved applications and their linked venues show here.",
      };
    case "REJECTED":
      return {
        title: "No rejected applications yet.",
        description: "Rejected applications remain available for history.",
      };
    case "WITHDRAWN":
      return {
        title: "No withdrawn applications yet.",
        description: "Withdrawn applications appear here when present.",
      };
    default:
      return {
        title: "No requests yet.",
        description: "Applications submitted by hosts will appear in this list.",
      };
  }
}

function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
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

  const venues = useAdminResource(!mockMode, async (token) => {
    const res = await listVenues(token);
    return res.venues.map((v) => ({
      id: v.id,
      label: `${v.name}${v.area ? ` · ${v.area}` : ""}`,
      hostedBy: resolveHostedBy(v.hostedBy),
    }));
  });

  const venueHostedByById = useMemo(() => {
    const map = new Map<string, HostedBy>();
    for (const v of venues.data ?? []) {
      map.set(v.id, v.hostedBy);
    }
    return map;
  }, [venues.data]);

  /** Load all statuses so KPIs and filters share one source. */
  const { data, loading, error, reload } = useAdminResource(
    !mockMode,
    async (token) => {
      const res = await listHostApplications(token, "ALL");
      return res.applications;
    },
  );

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
        linkedVenueId: null as string | null,
        linkedVenueHostedBy: null as HostedBy | null,
        rejectionReason: "",
      }));
    }
    return (data ?? []).map((a) => mapHost(a, venueHostedByById));
  }, [localRows, mockMode, data, venueHostedByById]);

  const filtered = useMemo(() => {
    if (status === "ALL") return rows;
    return rows.filter((r) => r.status === status);
  }, [rows, status]);

  const kpi = hostApplicationKpis(rows);
  const kpisReady = mockMode || data != null;

  async function onApprove(id: string) {
    if (busyId) return;
    const linkId = linkVenueId[id]?.trim();
    const ok = confirmDestructive(
      linkId
        ? "Approve and link to the selected existing venue? That venue keeps its current organizing model."
        : "Approve this application? A Venue-organized venue and owner will be created through the existing API.",
    );
    if (!ok) return;

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
      await approveHostApplication(token, id, linkId || undefined);
      setLocalRows(null);
      await reload();
      await venues.reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not approve application.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(id: string) {
    if (busyId) return;
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

  const empty = emptyCopy(status);

  return (
    <div className="nyto-fade">
      <ModuleHero
        eyebrow="Network"
        title="Requests & Approvals"
        description="Review Venue-organized onboarding. Approve creates or links a venue through the existing API — venues appear on Venues only after that succeeds."
        stats={[
          {
            label: "Awaiting review",
            value: kpisReady ? String(kpi.awaitingReview) : "—",
          },
          {
            label: "Approved",
            value: kpisReady ? String(kpi.approved) : "—",
            soft: true,
          },
          {
            label: "Rejected",
            value: kpisReady ? String(kpi.rejected) : "—",
            soft: true,
          },
        ]}
      />

      {error ? (
        <ErrorBanner message={error} onRetry={() => void reload()} />
      ) : null}
      {actionError ? (
        <ErrorBanner
          message={actionError}
          onRetry={() => setActionError(null)}
        />
      ) : null}

      <ModuleFilters>
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="Application status"
        >
          {(
            [
              ["PENDING", "Awaiting review", kpi.awaitingReview],
              ["APPROVED", "Approved", kpi.approved],
              ["REJECTED", "Rejected", kpi.rejected],
              ["WITHDRAWN", "Withdrawn", kpi.withdrawn],
              ["ALL", "All", kpi.totalLoaded],
            ] as const
          ).map(([id, label, count]) => (
            <ModulePill
              key={id}
              active={status === id}
              onClick={() => setStatus(id)}
              label={label}
              count={kpisReady ? count : undefined}
            />
          ))}
        </div>
      </ModuleFilters>

      {loading && !mockMode && !data ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <div className="space-y-2">
          <p className="px-0.5 text-[12px] text-text-faint">
            {countLabel(filtered.length, "application", "applications")}
          </p>
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
                      <Badge tone={applicationStatusTone(r.status)}>
                        {applicationStatusLabel(r.status)}
                      </Badge>
                      {r.linkedVenueHostedBy ? (
                        <HostedByBadge value={r.linkedVenueHostedBy} short />
                      ) : null}
                    </div>
                    <p className="mt-1 text-[14px] text-text-muted">
                      {r.venue}
                      {r.area !== "—" ? ` · ${r.area}` : ""} · {r.city}
                    </p>
                    <p className="mt-1 text-[13px] text-text-faint">
                      {r.phone}
                      {r.email !== "—" ? ` · ${r.email}` : ""}
                    </p>
                    {r.status === "APPROVED" && !r.linkedVenueId ? (
                      <p className="mt-1.5 text-[12px] text-warning">
                        Approved, but no linked venue was returned by the API.
                      </p>
                    ) : null}
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
                          disabled={busyId != null}
                          onClick={() => void onReject(r.id)}
                        >
                          Reject
                        </Button>
                        <Button
                          disabled={busyId != null}
                          onClick={() => void onApprove(r.id)}
                        >
                          {busyId === r.id ? "Working…" : "Approve"}
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
                      {r.linkedVenueId ? (
                        <div className="sm:col-span-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
                            Linked venue
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-text">
                            <span>{r.venue}</span>
                            {r.linkedVenueHostedBy ? (
                              <HostedByBadge value={r.linkedVenueHostedBy} />
                            ) : (
                              <span className="text-text-faint">
                                Organizing model unavailable on this record
                              </span>
                            )}
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
                            <option value="">
                              Create new Venue-organized venue from application
                            </option>
                            {(venues.data ?? []).map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.label} ·{" "}
                                {v.hostedBy === "PARTNER"
                                  ? "Venue-organized"
                                  : "NYTO-organized"}
                              </option>
                            ))}
                          </Select>
                          <p className="mt-1.5 text-[12px] text-text-faint">
                            Linking an existing venue keeps that venue&apos;s
                            organizing model unchanged.
                          </p>
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
