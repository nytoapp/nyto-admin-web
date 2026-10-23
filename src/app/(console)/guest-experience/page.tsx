"use client";

import Link from "next/link";
import { ModuleHero } from "@/components/ui/ModuleShell";

/**
 * Guest Experience = guest issues & support inbox for ops.
 * Bookings stay in /bookings. This page is for complaints, reports, follow-ups,
 * and feedback from the guest app — not a second booking list.
 *
 * Admin APIs for those records are not connected yet; we show honest empty
 * states (never fake issues). See docs/guest-experience-backend-gaps.md.
 */

export default function GuestExperiencePage() {
  return (
    <div className="nyto-fade mx-auto max-w-5xl">
      <ModuleHero
        eyebrow="Operations"
        title="Guest Experience"
        description="Issues, complaints, and follow-ups guests raise from the NYTO app."
        stats={[
          {
            label: "Open complaints",
            value: "—",
            hint: "Not connected",
            soft: true,
          },
          {
            label: "Follow-ups due",
            value: "—",
            hint: "Not connected",
            soft: true,
          },
          {
            label: "Guest feedback",
            value: "—",
            hint: "Not connected",
            soft: true,
          },
          {
            label: "New reports",
            value: "—",
            hint: "Not connected",
            soft: true,
          },
        ]}
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/70 shadow-[var(--shadow-sm)]">
        <div className="border-b border-border-subtle px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            Support inbox
          </p>
        </div>
        <div className="grid gap-px bg-border-subtle sm:grid-cols-2">
          <SupportTile
            title="Complaints & reports"
            body="When a guest reports a problem from the app, it will land here for admin review."
            status="Not connected"
          />
          <SupportTile
            title="Follow-ups"
            body="Assigned cases and due follow-ups after a complaint or dining-night issue."
            status="Not connected"
          />
          <SupportTile
            title="Guest feedback"
            body="Post-night feedback and ratings submitted by guests."
            status="Not connected"
          />
          <SupportTile
            title="Report alerts"
            body="Instant notice when a new complaint or safety report is submitted."
            status="Not connected"
          />
        </div>
      </section>

      <p className="mt-5 text-[13px] text-text-muted">
        Reservations and payment status live in{" "}
        <Link
          href="/bookings"
          className="font-semibold text-accent hover:underline"
        >
          Bookings
        </Link>
        . Guest profiles and visit history live in{" "}
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

function SupportTile({
  title,
  body,
  status,
}: {
  title: string;
  body: string;
  status: string;
}) {
  return (
    <div className="bg-bg-elevated px-5 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold tracking-[-0.02em] text-ink">
          {title}
        </p>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">
          {status}
        </span>
      </div>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-text-muted">
        {body}
      </p>
    </div>
  );
}
