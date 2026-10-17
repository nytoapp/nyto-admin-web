/** Frontend-first venue contacts until backend ships. */

export type VenueContact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  shiftStart: string;
  shiftEnd: string;
};

const key = (venueId: string) => `nyto.admin.venueContacts.${venueId}`;

export function loadVenueContacts(venueId: string): VenueContact[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(venueId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VenueContact[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveVenueContacts(
  venueId: string,
  contacts: VenueContact[],
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(venueId), JSON.stringify(contacts));
}

/** Format HTML time inputs (HH:MM) for display. */
export function formatShiftRange(
  start: string,
  end: string,
  hour12 = true,
): string {
  if (!start || !end) return "—";
  const fmt = (t: string) => {
    const [hRaw, mRaw] = t.split(":");
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (Number.isNaN(h) || Number.isNaN(m)) return t;
    if (!hour12) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}
