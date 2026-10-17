"use client";

import { Badge } from "@/components/ui/Badge";
import {
  HOSTED_BY_FILTERS,
  hostedByLabel,
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
    <Badge tone={hostedByTone(value)}>
      {short ? (value === "PARTNER" ? "Partner" : "NYTO") : hostedByLabel(value)}
    </Badge>
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
      aria-label="Hosted by"
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

export function NytoCuratedCreateNote() {
  return (
    <div className="rounded-xl border border-accent/25 bg-[var(--accent-wash)] px-3.5 py-3 text-[13px] leading-relaxed text-text-muted">
      <p className="font-semibold text-accent-soft">NYTO curated night</p>
      <p className="mt-1">
        Admin publishes nights only when NYTO is organising. Partner venues
        manage their own packages — we take the platform share.
      </p>
    </div>
  );
}
