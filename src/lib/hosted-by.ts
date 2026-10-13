/** Who runs the night. Frontend-first — backend field lands later. */
export type HostedBy = "NYTO" | "PARTNER";

export type HostedByFilter = "all" | HostedBy;

export const HOSTED_BY_FILTERS: { id: HostedByFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "NYTO", label: "NYTO" },
  { id: "PARTNER", label: "Partner" },
];

export function resolveHostedBy(raw: unknown): HostedBy {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "PARTNER" || v === "VENUE" || v === "PARTNER_HOSTED") {
    return "PARTNER";
  }
  return "NYTO";
}

/** Short chip / filter label */
export function hostedByShort(value: HostedBy): string {
  return value === "PARTNER" ? "Partner" : "NYTO";
}

/** Full badge label */
export function hostedByLabel(value: HostedBy): string {
  return value === "PARTNER" ? "Partner hosted" : "NYTO curated";
}

export function hostedByTone(
  value: HostedBy,
): "accent" | "success" | "neutral" {
  return value === "PARTNER" ? "success" : "accent";
}

export function hostedByHint(value: HostedBy): string {
  return value === "PARTNER"
    ? "Created and run by the venue on NYTO."
    : "Curated and run by NYTO at this venue.";
}
