/** Who organises the dining experience. Stored values remain NYTO | PARTNER. */
export type HostedBy = "NYTO" | "PARTNER";

export type HostedByFilter = "all" | HostedBy;

export const HOSTED_BY_FILTERS: { id: HostedByFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "NYTO", label: "NYTO-organized" },
  { id: "PARTNER", label: "Venue-organized" },
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

/** Compact badge / chip label */
export function hostedByShort(value: HostedBy): string {
  return value === "PARTNER" ? "Venue-organized" : "NYTO-organized";
}

/** Full badge label — who organises the experience */
export function hostedByLabel(value: HostedBy): string {
  return value === "PARTNER" ? "Venue-organized" : "NYTO-organized";
}

export function hostedByTone(
  value: HostedBy,
): "accent" | "success" | "neutral" {
  return value === "PARTNER" ? "success" : "accent";
}

export function hostedByHint(value: HostedBy): string {
  return value === "PARTNER"
    ? "The venue organises and publishes this experience."
    : "NYTO organises and manages this experience.";
}
