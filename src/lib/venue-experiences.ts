import type { ExperienceCategory } from "@/lib/categories";

/** Frontend-first night extras until menu/table APIs carry categories fully. */

export type StoredNight = {
  id: string;
  menuId?: string;
  tableId?: string;
  name: string;
  diet: string;
  cost: string;
  costPerHead: number;
  categories: ExperienceCategory[];
  when: string;
  startsAtIso?: string;
  capacity: number;
  status: "OPEN" | "FULL" | "CANCELLED";
};

const key = (venueId: string) => `nyto.admin.venueNights.${venueId}`;

export function loadVenueNights(venueId: string): StoredNight[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(venueId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredNight[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVenueNights(venueId: string, nights: StoredNight[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(venueId), JSON.stringify(nights));
}

export function upsertVenueNight(venueId: string, night: StoredNight): void {
  const prev = loadVenueNights(venueId);
  const next = [night, ...prev.filter((n) => n.id !== night.id)];
  saveVenueNights(venueId, next);
}

export function categoriesForVenue(venueId: string): ExperienceCategory[] {
  const set = new Set<ExperienceCategory>();
  for (const n of loadVenueNights(venueId)) {
    for (const c of n.categories) set.add(c);
  }
  return [...set];
}

export type NightPhaseFilter = "all" | "upcoming" | "cancelled";

export function venueMatchesNightPhase(
  venueId: string,
  phase: NightPhaseFilter,
): boolean {
  if (phase === "all") return true;
  const nights = loadVenueNights(venueId);
  if (nights.length === 0) return false;
  const now = Date.now();
  return nights.some((n) => {
    if (phase === "cancelled") return n.status === "CANCELLED";
    if (n.status === "CANCELLED") return false;
    const t = n.startsAtIso ? new Date(n.startsAtIso).getTime() : NaN;
    if (Number.isNaN(t)) {
      return phase === "upcoming";
    }
    if (phase === "upcoming") return t > now;
    return false;
  });
}
