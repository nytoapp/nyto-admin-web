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

function guestName(t: AdminSupportTicket): string {
  return (
    t.user?.fullName?.trim() ||
    t.user?.firstName?.trim() ||
    t.user?.email ||
    t.user?.phone ||
    "Guest"
  );
}

export default function GuestExperiencePage() {
  const { mockMode, getToken } = useAuth();
  const [tab, setTab] = useState<InboxTab>("venue");
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reloadTickets() {
    if (mockMode) {
      setTickets([]);
      return;
    }
    setLoadError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError("Session expired.", 401);
      const res = await listSupportTickets(token);
      setTickets(res.tickets);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Could not load support tickets.",
      );
      setTickets([]);
    }
  }

  useEffect(() => {
    void reloadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockMode]);

  const venueTickets = useMemo(
    () => tickets.filter((t) => t.source === "VENUE"),
    [tickets],
  );
  const guestComplaints = useMemo(
    () =>
      tickets.filter(
        (t) => t.source === "GUEST" && t.category !== "FEEDBACK",
      ),
    [tickets],
  );
  const guestFeedback = useMemo(
    () =>
      tickets.filter(
        (t) => t.source === "GUEST" && t.category === "FEEDBACK",
      ),
    [tickets],
  );
  const followUps = useMemo(
    () =>
      tickets.filter(
        (t) => t.status === "OPEN" || t.status === "IN_REVIEW",
      ),
    [tickets],
  );

  const openVenue = venueTickets.filter((t) => t.status === "OPEN").length;

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

  function TicketActions({ t }: { t: AdminSupportTicket }) {
    return (
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
    );
  }

  function LiveTicketList({
    rows,
    empty,
  }: {
    rows: AdminSupportTicket[];
    empty: string;
  }) {
    if (rows.length === 0) {
      return (
        <p className="px-5 py-8 text-[13px] text-text-muted">{empty}</p>
      );
    }
    return (
      <ModuleFeed>
        {rows.map((t) => (
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
                    <Badge tone="neutral">{t.source}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-text-muted">
                    {t.source === "GUEST" ? guestName(t) : t.venue?.name ?? "Venue"}
                    {t.venue?.area ? ` · ${t.venue.area}` : ""}
                    {t.staff?.email ? ` · ${t.staff.email}` : ""}
                    {t.user?.email && t.source === "GUEST"
                      ? ` · ${t.user.email}`
                      : ""}
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
                    {t.message}
                  </p>
                </div>
                <TicketActions t={t} />
              </div>
            </ModuleFeedRow>
          </li>
        ))}
      </ModuleFeed>
    );
  }

  return (
    <div className="nyto-fade mx-auto max-w-5xl">
      <ModuleHero
        eyebrow="Operations"
        title="Guest Experience"
        description="Venue Contact NYTO and guest Help Center tickets sync live. Follow-ups are open / in-review work."
        stats={[
          {
            label: "Venue tickets open",
            value: mockMode ? "—" : String(openVenue),
            hint: "From venue portal",
          },
          {
            label: "Guest complaints",
            value: mockMode
              ? String(DEMO_GUEST_COMPLAINTS.length)
              : String(guestComplaints.length),
            hint: mockMode ? "Sample only" : "From guest app",
            soft: mockMode,
          },
          {
            label: "Follow-ups due",
            value: mockMode
              ? String(DEMO_GUEST_FOLLOWUPS.length)
              : String(followUps.length),
            hint: mockMode ? "Demo samples" : "Open + reviewing",
            soft: mockMode,
          },
          {
            label: "Guest feedback",
            value: mockMode
              ? String(DEMO_GUEST_FEEDBACK.length)
              : String(guestFeedback.length),
            hint: mockMode ? "Demo samples" : "FEEDBACK category",
            soft: mockMode,
          },
        ]}
      />

      {loadError ? (
        <ErrorBanner
          message={loadError}
          onRetry={() => void reloadTickets()}
        />
      ) : null}

      <ModuleFilters>
        <div className="flex flex-wrap gap-1.5">
          <ModulePill
            active={tab === "venue"}
            onClick={() => setTab("venue")}
            label="Venue tickets"
            count={mockMode ? undefined : venueTickets.length}
          />
          <ModulePill
            active={tab === "complaints"}
            onClick={() => setTab("complaints")}
            label="Guest complaints"
            count={
              mockMode
                ? DEMO_GUEST_COMPLAINTS.length
                : guestComplaints.length
            }
          />
          <ModulePill
            active={tab === "followups"}
            onClick={() => setTab("followups")}
            label="Follow-ups"
            count={
              mockMode ? DEMO_GUEST_FOLLOWUPS.length : followUps.length
            }
          />
          <ModulePill
            active={tab === "feedback"}
            onClick={() => setTab("feedback")}
            label="Feedback"
            count={
              mockMode ? DEMO_GUEST_FEEDBACK.length : guestFeedback.length
            }
          />
        </div>
      </ModuleFilters>

      <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
        <div className="border-b border-border-subtle px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Support inbox
          </p>
        </div>

        {tab === "venue" ? (
          mockMode ? (
            <p className="px-5 py-8 text-[13px] text-text-muted">
              Switch Admin to live auth to see venue Contact NYTO tickets from
              Postgres.
            </p>
          ) : (
            <LiveTicketList
              rows={venueTickets}
              empty="No venue tickets yet. Partner kitchens file them from Contact NYTO."
            />
          )
        ) : null}

        {tab === "complaints" ? (
          mockMode ? (
            <>
              <p className="border-b border-border-subtle px-5 py-2.5 text-[12px] text-accent-soft">
                Sample guest complaints — live auth loads Help Center tickets.
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
                      <p className="mt-2 text-[14px] text-text-muted">
                        {c.summary}
                      </p>
                    </ModuleFeedRow>
                  </li>
                ))}
              </ModuleFeed>
            </>
          ) : (
            <LiveTicketList
              rows={guestComplaints}
              empty="No guest complaints yet. Guests file them from Help Center."
            />
          )
        ) : null}

        {tab === "followups" ? (
          mockMode ? (
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
                      <p className="mt-2 text-[14px] text-text-muted">
                        {f.action}
                      </p>
                    </ModuleFeedRow>
                  </li>
                ))}
              </ModuleFeed>
            </>
          ) : (
            <LiveTicketList
              rows={followUps}
              empty="Nothing needs follow-up — all tickets resolved."
            />
          )
        ) : null}

        {tab === "feedback" ? (
          mockMode ? (
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
          ) : (
            <LiveTicketList
              rows={guestFeedback}
              empty="No guest feedback yet."
            />
          )
        ) : null}
      </section>
    </div>
  );
}
