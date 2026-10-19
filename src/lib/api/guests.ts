import { apiRequest } from "@/lib/api/client";

/**
 * `/admin/guests` returns consumer accounts with role USER only (admins/staff
 * excluded server-side). List is capped (take: 100). `bookings` is booking
 * record count; `lastVenue` is from the newest booking by createdAt when present.
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
};

export async function listGuests(token: string, q?: string) {
  const suffix = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return apiRequest<{ ok: true; guests: GuestRow[] }>(`/admin/guests${suffix}`, {
    token,
  });
}
