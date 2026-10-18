import type { HostedBy } from "@/lib/hosted-by";
import { loadVenueContacts } from "@/lib/venue-contacts";

const hostedKey = (venueId: string) => `nyto.admin.venueHostedBy.${venueId}`;

/** Frontend-first organised-by until backend field ships. */
export function loadVenueHostedBy(venueId: string): HostedBy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(hostedKey(venueId));
    if (raw === "NYTO" || raw === "PARTNER") return raw;
    return null;
  } catch {
    return null;
  }
}

export function saveVenueHostedBy(venueId: string, value: HostedBy): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(hostedKey(venueId), value);
}

export function contactCountForVenue(venueId: string, fallback = 0): number {
  const stored = loadVenueContacts(venueId);
  if (stored) return stored.length;
  return fallback;
}
