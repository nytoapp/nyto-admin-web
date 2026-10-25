import { apiRequest } from "@/lib/api/client";
import type { GuestPreferences } from "@/lib/guest-preferences";

/**
 * `/admin/guests` returns consumer accounts with role USER only (admins/staff
 * excluded server-side). List is capped (take: 100). `bookings` is booking
 * record count; `lastVenue` is from the newest booking by createdAt when present.
 *
 * Preferences come from the guest app (onboarding + table profile).
 */
export type GuestRow = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  /** Number of booking records for this guest (any status). */
  bookings: number;
  /** Venue name from most recent booking, if any. */
  lastVenue?: string | null;
  /** ACTIVE = has booked; NEW = never booked (server-derived). */
  status: "ACTIVE" | "NEW" | string;
} & GuestPreferences;

export async function listGuests(token: string, q?: string) {
  const suffix = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return apiRequest<{ ok: true; guests: GuestRow[] }>(`/admin/guests${suffix}`, {
    token,
  });
}

/** Table group chat membership — same groups as in the NYTO guest app. */
export type GuestTableGroupMember = {
  userId: string;
  name: string;
  isSelf: boolean;
  attended: boolean;
};

export type GuestTableGroup = {
  tableId: string;
  venueId: string;
  venueName: string;
  city: string;
  area: string | null;
  startsAt: string;
  tableType: string;
  paymentType: string;
  tableStatus: string;
  menuName: string | null;
  capacity: number;
  memberCount: number;
  /** Chat still open in the guest app (active or grace period). */
  activeInApp: boolean;
  chatState: "ACTIVE" | "GRACE_PERIOD" | "DISABLED" | string;
  attended: boolean;
  joinedAt: string;
  members: GuestTableGroupMember[];
};

export async function getGuest(token: string, id: string) {
  return apiRequest<{
    ok: true;
    guest: GuestRow;
    tableGroups: GuestTableGroup[];
  }>(`/admin/guests/${encodeURIComponent(id)}`, { token });
}
