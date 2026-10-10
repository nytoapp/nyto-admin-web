import { apiRequest } from "@/lib/api/client";
import type { AdminBooking, AdminTable, Venue } from "@/lib/types";

export type NetworkTable = AdminTable & {
  venue?: Pick<Venue, "id" | "name" | "city" | "area">;
};

export async function listTables(
  token: string,
  params?: { venueId?: string; status?: string },
) {
  const q = new URLSearchParams();
  if (params?.venueId) q.set("venueId", params.venueId);
  if (params?.status) q.set("status", params.status);
  const suffix = q.toString() ? `?${q}` : "";
  return apiRequest<{ ok: true; tables: NetworkTable[] }>(
    `/admin/tables${suffix}`,
    { token },
  );
}

export async function listTableBookings(token: string, tableId: string) {
  return apiRequest<{
    ok: true;
    table: {
      id: string;
      startsAt: string;
      capacity: number;
      status: string;
      seatPrice: number;
      venue?: Pick<Venue, "id" | "name" | "city" | "area">;
      menu?: { id: string; name: string } | null;
    };
    bookings: AdminBooking[];
  }>(`/admin/tables/${tableId}/bookings`, { token });
}
