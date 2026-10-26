"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  ModuleFeed,
  ModuleFeedRow,
  ModuleFilters,
  ModuleHero,
  ModulePill,
} from "@/components/ui/ModuleShell";
import { ErrorBanner } from "@/components/ui/Page";
import { ApiError } from "@/lib/api/client";
import {
  listSupportTickets,
  patchSupportTicket,
  type AdminSupportTicket,
} from "@/lib/api/support";
import {
  DEMO_GUEST_COMPLAINTS,
  DEMO_GUEST_FEEDBACK,
  DEMO_GUEST_FOLLOWUPS,
} from "@/lib/mock/data";
import { useAuth } from "@/providers/auth-provider";

type InboxTab = "venue" | "complaints" | "followups" | "feedback";

function ticketStatusTone(
  s: string,
): "accent" | "warning" | "success" | "neutral" {
  const u = s.toUpperCase();
  if (u === "OPEN") return "accent";
  if (u === "IN_REVIEW") return "warning";
  if (u === "RESOLVED") return "success";
  return "neutral";
}

export default function GuestExperiencePage() {
  const { mockMode, getToken } = useAuth();
  const [tab, setTab] = useState<InboxTab>("venue");
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reloadVenueTickets() {
    if (mockMode) {
      setTickets([]);
      return;
    }
    setLoadError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      const res = await listSupportTickets(token, { source: "VENUE" });
      setTickets(res.tickets);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Could not load venue tickets.",
      );
      setTickets([]);
    }
  }

  useEffect(() => {
    void reloadVenueTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockMode]);

  const openVenue = tickets.filter((t) => t.status === "OPEN").length;
  const openComplaints = DEMO_GUEST_COMPLAINTS.length;
  const followUpsDue = DEMO_GUEST_FOLLOWUPS.length;
  const feedbackCount = DEMO_GUEST_FEEDBACK.length;

  const list = useMemo(() => {
    if (tab === "followups") return { kind: "followups" as const };
    if (tab === "feedback") return { kind: "feedback" as const };
    if (tab === "venue") return { kind: "venue" as const };
    return { kind: "complaints" as const };
  }, [tab]);

  async function setStatus(
    id: string,
    status: "OPEN" | "IN_REVIEW" | "RESOLVED",
  ) {
    if (mockMode || busyId) return;
    setBusyId(id);
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      const res = await patchSupportTicket(token, id, status);
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...res.ticket } : t)),
      );
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Could not update ticket.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="nyto-fade mx-auto max-w-5xl">
      <ModuleHero
        eyebrow="Operations"
        title="Guest Experience"
        description="Venue Contact NYTO tickets sync live. Guest-app complaints stay demo until that API ships."
        stats={[
          {
            label: "Venue tickets open",
            value: mockMode ? "—" : String(openVenue),
            hint: "From venue portal",
          },
          {
            label: "Demo complaints",
            value: String(openComplaints),
            hint: "Sample only",
            soft: true,
          },
          {
            label: "Follow-ups due",
            value: String(followUpsDue),
            hint: "Demo samples",
            soft: true,
          },
          {
            label: "Guest feedback",
            value: String(feedbackCount),
            hint: "Demo samples",
            soft: true,
          },
        ]}
      />

      {loadError ? (
        <ErrorBanner
          message={loadError}
          onRetry={() => void reloadVenueTickets()}
        />
      ) : null}

      <ModuleFilters>
        <div className="flex flex-wrap gap-1.5">
          <ModulePill
            active={tab === "venue"}
            onClick={() => setTab("venue")}
            label="Venue tickets"
            count={mockMode ? undefined : tickets.length}
          />
          <ModulePill
            active={tab === "complaints"}
            onClick={() => setTab("complaints")}
            label="Guest complaints"
            count={DEMO_GUEST_COMPLAINTS.length}
          />
          <ModulePill
            active={tab === "followups"}
            onClick={() => setTab("followups")}
            label="Follow-ups"
            count={DEMO_GUEST_FOLLOWUPS.length}
          />
          <ModulePill
            active={tab === "feedback"}
            onClick={() => setTab("feedback")}
            label="Feedback"
            count={DEMO_GUEST_FEEDBACK.length}
          />
        </div>
      </ModuleFilters>

      <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
        <div className="border-b border-border-subtle px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Support inbox
          </p>
        </div>

        {list.kind === "venue" ? (
          mockMode ? (
            <p className="px-5 py-8 text-[13px] text-text-muted">
              Switch Admin to live auth to see venue Contact NYTO tickets from
              Postgres.
            </p>
          ) : tickets.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-text-muted">
              No venue tickets yet. Partner kitchens file them from Contact NYTO.
            </p>
          ) : (
            <ModuleFeed>
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="border-b border-border-subtle last:border-0"
                >
                  <ModuleFeedRow>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[15px] font-semibold text-ink">
                            {t.subject}
                          </p>
                          <Badge tone={ticketStatusTone(t.status)}>
                            {t.status.replace("_", " ")}
                          </Badge>
                          <Badge tone="neutral">{t.category}</Badge>
                        </div>
                        <p className="mt-1 text-[13px] text-text-muted">
                          {t.venue?.name ?? "Venue"}
                          {t.venue?.area ? ` · ${t.venue.area}` : ""}
                          {t.staff?.email ? ` · ${t.staff.email}` : ""}
                        </p>
                        <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
                          {t.message}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {t.venue?.id ? (
                          <Link href={`/venues/${t.venue.id}`}>
                            <Button variant="ghost">Open venue</Button>
                          </Link>
                        ) : null}
                        {t.status !== "IN_REVIEW" ? (
                          <Button
                            variant="secondary"
                            disabled={busyId === t.id}
                            onClick={() => void setStatus(t.id, "IN_REVIEW")}
                          >
                            Reviewing
                          </Button>
                        ) : null}
                        {t.status !== "RESOLVED" ? (
                          <Button
                            disabled={busyId === t.id}
                            onClick={() => void setStatus(t.id, "RESOLVED")}
                          >
                            Resolve
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </ModuleFeedRow>
                </li>
              ))}
            </ModuleFeed>
          )
        ) : null}

        {list.kind === "complaints" ? (
          <>
            <p className="border-b border-border-subtle px-5 py-2.5 text-[12px] text-accent-soft">
              Sample guest complaints — not live app reports yet.
            </p>
            <ModuleFeed>
              {DEMO_GUEST_COMPLAINTS.map((c) => (
                <li
                  key={c.id}
                  className="border-b border-border-subtle last:border-0"
                >
                  <ModuleFeedRow>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-ink">
                        {c.guest}
                      </p>
                      <Badge tone="warning">{c.status}</Badge>
                      <Badge tone="neutral">{c.category}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-text-muted">
                      {c.venue} · {c.when}
                    </p>
                    <p className="mt-2 text-[14px] text-text-muted">{c.summary}</p>
                  </ModuleFeedRow>
                </li>
              ))}
            </ModuleFeed>
          </>
        ) : null}

        {list.kind === "followups" ? (
          <>
            <p className="border-b border-border-subtle px-5 py-2.5 text-[12px] text-accent-soft">
              Demo follow-ups.
            </p>
            <ModuleFeed>
              {DEMO_GUEST_FOLLOWUPS.map((f) => (
                <li
                  key={f.id}
                  className="border-b border-border-subtle last:border-0"
                >
                  <ModuleFeedRow>
                    <p className="text-[15px] font-semibold text-ink">
                      {f.guest} · {f.venue}
                    </p>
                    <p className="mt-1 text-[13px] text-text-muted">
                      Due {f.dueDate} · {f.status}
                    </p>
                    <p className="mt-2 text-[14px] text-text-muted">{f.action}</p>
                  </ModuleFeedRow>
                </li>
              ))}
            </ModuleFeed>
          </>
        ) : null}

        {list.kind === "feedback" ? (
          <>
            <p className="border-b border-border-subtle px-5 py-2.5 text-[12px] text-accent-soft">
              Demo feedback.
            </p>
            <ModuleFeed>
              {DEMO_GUEST_FEEDBACK.map((f) => (
                <li
                  key={f.id}
                  className="border-b border-border-subtle last:border-0"
                >
                  <ModuleFeedRow>
                    <p className="text-[15px] font-semibold text-ink">
                      {f.guest} · {f.rating}
                    </p>
                    <p className="mt-1 text-[13px] text-text-muted">
                      {f.venue} · {f.when}
                    </p>
                    <p className="mt-2 text-[14px] text-text-muted">{f.note}</p>
                  </ModuleFeedRow>
                </li>
              ))}
            </ModuleFeed>
          </>
        ) : null}
      </section>
    </div>
  );
}
