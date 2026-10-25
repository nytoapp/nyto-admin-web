"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import {
  ModuleFeed,
  ModuleFeedRow,
  ModuleFilters,
  ModuleHero,
  ModulePill,
} from "@/components/ui/ModuleShell";
import {
  DEMO_GUEST_COMPLAINTS,
  DEMO_GUEST_FEEDBACK,
  DEMO_GUEST_FOLLOWUPS,
} from "@/lib/mock/data";

/**
 * Guest Experience = support inbox for guest issues from the NYTO app.
 * Live complaint APIs are not connected yet. This page shows labeled demo
 * samples for presentations — not live guest submissions.
 */

type InboxTab = "complaints" | "followups" | "feedback";

export default function GuestExperiencePage() {
  const [tab, setTab] = useState<InboxTab>("complaints");

  const openComplaints = DEMO_GUEST_COMPLAINTS.length;
  const followUpsDue = DEMO_GUEST_FOLLOWUPS.length;
  const feedbackCount = DEMO_GUEST_FEEDBACK.length;
  const newReports = DEMO_GUEST_COMPLAINTS.filter(
    (c) => c.status === "New",
  ).length;

  const list = useMemo(() => {
    if (tab === "followups") return { kind: "followups" as const };
    if (tab === "feedback") return { kind: "feedback" as const };
    return { kind: "complaints" as const };
  }, [tab]);

  return (
    <div className="nyto-fade mx-auto max-w-5xl">
      <ModuleHero
        eyebrow="Operations"
        title="Guest Experience"
        description="Issues, complaints, and follow-ups guests raise from the NYTO app."
        stats={[
          {
            label: "Open complaints",
            value: String(openComplaints),
            hint: "Needs review",
          },
          {
            label: "Follow-ups due",
            value: String(followUpsDue),
            hint: "Next actions",
          },
          {
            label: "Guest feedback",
            value: String(feedbackCount),
            hint: "Recent notes",
            soft: true,
          },
          {
            label: "New reports",
            value: String(newReports),
            hint: "Unread",
            soft: true,
          },
        ]}
      />

      <p className="mb-4 rounded-xl border border-accent/25 bg-[var(--accent-wash)] px-4 py-2.5 text-[12px] leading-relaxed text-accent-soft">
        Sample inbox for demo — not live guest reports.
      </p>

      <ModuleFilters>
        <div className="flex flex-wrap gap-1.5">
          <ModulePill
            active={tab === "complaints"}
            onClick={() => setTab("complaints")}
            label="Complaints"
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

        {list.kind === "complaints" ? (
          <ModuleFeed>
            {DEMO_GUEST_COMPLAINTS.map((c) => (
              <li
                key={c.id}
                className="border-b border-border-subtle last:border-0"
              >
                <ModuleFeedRow>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-ink">
                          {c.guest}
                        </p>
                        <Badge tone="accent">Demo</Badge>
                      </div>
                      <p className="mt-1 text-[13px] text-text-muted">
                        {[c.venue, c.when, c.category].join(" · ")}
                      </p>
                      <p className="mt-1.5 text-[13px] leading-snug text-text">
                        {c.summary}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                      <Badge
                        tone={
                          c.priority === "High" ? "warning" : "neutral"
                        }
                      >
                        {c.priority}
                      </Badge>
                      <Badge tone="neutral">{c.status}</Badge>
                    </div>
                  </div>
                </ModuleFeedRow>
              </li>
            ))}
          </ModuleFeed>
        ) : null}

        {list.kind === "followups" ? (
          <ModuleFeed>
            {DEMO_GUEST_FOLLOWUPS.map((f) => (
              <li
                key={f.id}
                className="border-b border-border-subtle last:border-0"
              >
                <ModuleFeedRow>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-ink">
                          {f.guest}
                        </p>
                        <Badge tone="accent">Demo</Badge>
                      </div>
                      <p className="mt-1 text-[13px] text-text-muted">
                        {f.venue} · Due {f.dueDate}
                      </p>
                      <p className="mt-1.5 text-[13px] leading-snug text-text">
                        {f.action}
                      </p>
                    </div>
                    <Badge tone="neutral">{f.status}</Badge>
                  </div>
                </ModuleFeedRow>
              </li>
            ))}
          </ModuleFeed>
        ) : null}

        {list.kind === "feedback" ? (
          <ModuleFeed>
            {DEMO_GUEST_FEEDBACK.map((fb) => (
              <li
                key={fb.id}
                className="border-b border-border-subtle last:border-0"
              >
                <ModuleFeedRow>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-ink">
                          {fb.guest}
                        </p>
                        <Badge tone="accent">Demo</Badge>
                      </div>
                      <p className="mt-1 text-[13px] text-text-muted">
                        {[fb.venue, fb.when].join(" · ")}
                      </p>
                      <p className="mt-1.5 text-[13px] leading-snug text-text">
                        {fb.note}
                      </p>
                    </div>
                    <Badge
                      tone={
                        fb.rating === "Positive"
                          ? "success"
                          : fb.rating === "Mixed"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {fb.rating}
                    </Badge>
                  </div>
                </ModuleFeedRow>
              </li>
            ))}
          </ModuleFeed>
        ) : null}
      </section>

      <p className="mt-5 text-[13px] text-text-muted">
        Live reservations stay in{" "}
        <Link
          href="/bookings"
          className="font-semibold text-accent hover:underline"
        >
          Bookings
        </Link>
        . Profiles stay in{" "}
        <Link
          href="/guests"
          className="font-semibold text-accent hover:underline"
        >
          Guests
        </Link>
        .
      </p>
    </div>
  );
}
