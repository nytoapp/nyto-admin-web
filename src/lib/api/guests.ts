import { apiRequest } from "@/lib/api/client";

export type GuestRow = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  bookings: number;
  lastVenue?: string | null;
  status: "ACTIVE" | "NEW" | string;
};

export async function listGuests(token: string, q?: string) {
  const suffix = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return apiRequest<{ ok: true; guests: GuestRow[] }>(`/admin/guests${suffix}`, {
    token,
  });
}
