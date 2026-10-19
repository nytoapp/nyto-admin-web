"use client";

import { Badge } from "@/components/ui/Badge";
import {
  HOSTED_BY_FILTERS,
  hostedByLabel,
  hostedByShort,
  hostedByTone,
  type HostedBy,
  type HostedByFilter,
} from "@/lib/hosted-by";

export function HostedByBadge({
  value,
  short = false,
}: {
  value: HostedBy;
  short?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full shrink-0 whitespace-nowrap">
      <Badge tone={hostedByTone(value)}>
        {short ? hostedByShort(value) : hostedByLabel(value)}
      </Badge>
    </span>
  );
}

export function HostedByFilterBar({
  value,
  onChange,
}: {
  value: HostedByFilter;
  onChange: (next: HostedByFilter) => void;
}) {
  return (
    <div
      className="flex flex-wrap rounded-xl border border-border bg-bg-elevated p-0.5"
      role="group"
      aria-label="Organized by"
    >
      {HOSTED_BY_FILTERS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
            value === item.id
              ? "bg-bg-soft text-ink"
              : "text-text-muted hover:text-text"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Compact notice for Venue-organized venues (view-only inventory in Admin). */
export function VenueOrganizedReadNote() {
  return (
    <p className="rounded-xl border border-border-subtle bg-bg/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-text-muted">
      This venue manages its own dining nights. Inventory is shown here for
      monitoring.
    </p>
  );
}

/** @deprecated Use VenueOrganizedReadNote */
export const PartnerHostedReadNote = VenueOrganizedReadNote;
