import { apiRequest } from "@/lib/api/client";
import type { AdminTable, Venue, VenueMenu } from "@/lib/types";

export type VenueCreateInput = {
  name: string;
  address: string;
  city: string;
  area?: string;
  lat?: number;
  lng?: number;
  isActive?: boolean;
  /** Persisted on Venue — drives who may publish packages. */
  hostedBy?: "NYTO" | "PARTNER";
};

export async function listVenues(token: string) {
  return apiRequest<{ ok: true; venues: Venue[] }>("/admin/venues", { token });
}

export async function getVenue(token: string, venueId: string) {
  return apiRequest<{ ok: true; venue: Venue }>(`/admin/venues/${venueId}`, {
    token,
  });
}

export type VenueStaffRow = {
  id: string;
  staffRole: "OWNER" | "MANAGER" | "STAFF" | string;
  isActive: boolean;
  user: {
    id: string;
    firstName?: string | null;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

export async function listVenueStaff(token: string, venueId: string) {
  return apiRequest<{ ok: true; staff: VenueStaffRow[] }>(
    `/admin/venues/${venueId}/staff`,
    { token },
  );
}

export async function createVenue(token: string, body: VenueCreateInput) {
  return apiRequest<{ ok: true; venue: Venue }>("/admin/venues", {
    method: "POST",
    token,
    body,
  });
}

export async function patchVenue(
  token: string,
  venueId: string,
  body: Partial<VenueCreateInput>,
) {
  return apiRequest<{ ok: true; venue: Venue }>(`/admin/venues/${venueId}`, {
    method: "PATCH",
    token,
    body,
  });
}

export async function listVenueMenus(token: string, venueId: string) {
  return apiRequest<{ ok: true; menus: VenueMenu[] }>(
    `/admin/venues/${venueId}/menus`,
    { token },
  );
}

export async function createVenueMenu(
  token: string,
  venueId: string,
  body: {
    name: string;
    description?: string;
    dietaryType: "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN";
    costPerHead: number;
  },
) {
  return apiRequest<{ ok: true; menu: VenueMenu }>(
    `/admin/venues/${venueId}/menus`,
    { method: "POST", token, body },
  );
}

export async function patchVenueMenu(
  token: string,
  menuId: string,
  body: {
    name?: string;
    description?: string;
    dietaryType?: "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN";
    costPerHead?: number;
  },
) {
  return apiRequest<{ ok: true; menu: VenueMenu }>(`/admin/menus/${menuId}`, {
    method: "PATCH",
    token,
    body,
  });
}

export async function deleteVenueMenu(token: string, menuId: string) {
  return apiRequest<{ ok: true }>(`/admin/menus/${menuId}`, {
    method: "DELETE",
    token,
  });
}

export async function listVenueTables(token: string, venueId: string) {
  return apiRequest<{ ok: true; tables: AdminTable[] }>(
    `/admin/venues/${venueId}/tables`,
    { token },
  );
}

export async function createVenueTable(
  token: string,
  venueId: string,
  body: {
    startsAt: string;
    seatPrice: number;
    priceTier: "DAYTIME" | "EVENING";
    capacity?: number;
    tableType?: "WEEKLY" | "WOMEN_LED" | "COUPLES" | "SINGLES";
    paymentType?: "ALL_INCLUSIVE" | "PAY_OWN_BILL";
    vibeCopy?: string;
    inclusions?: string[];
    menuId?: string;
    status?: "OPEN" | "CANCELLED";
    /** Admin create path is NYTO-organized only; Venue-organized publish from venue tooling. */
    hostedBy?: "NYTO";
  },
) {
  return apiRequest<{ ok: true; table: AdminTable }>(
    `/admin/venues/${venueId}/tables`,
    { method: "POST", token, body },
  );
}

export async function patchTable(
  token: string,
  tableId: string,
  body: Record<string, unknown>,
) {
  return apiRequest<{
    ok: true;
    table: AdminTable;
    cancelledBookings?: number;
    refundedPayments?: number;
  }>(`/admin/tables/${tableId}`, { method: "PATCH", token, body });
}

export async function cancelTable(
  token: string,
  tableId: string,
  reason?: string,
) {
  return apiRequest<{
    ok: true;
    table: AdminTable;
    cancelledBookings: number;
    refundedPayments: number;
  }>(`/admin/tables/${tableId}/cancel`, {
    method: "POST",
    token,
    body: { reason },
  });
}

export async function assignVenueStaff(
  token: string,
  venueId: string,
  body: {
    userId?: string;
    email?: string;
    name?: string;
    staffRole?: "OWNER" | "MANAGER" | "STAFF";
  },
) {
  return apiRequest<{ ok: true; staff: VenueStaffRow }>(
    `/admin/venues/${venueId}/staff`,
    { method: "POST", token, body },
  );
}

export async function removeVenueStaff(
  token: string,
  venueId: string,
  staffId: string,
) {
  return apiRequest<{ ok: true; staff: VenueStaffRow }>(
    `/admin/venues/${venueId}/staff/${staffId}`,
    { method: "DELETE", token },
  );
}
