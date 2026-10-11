import { apiRequest } from "@/lib/api/client";
import type { AdminBooking, AdminPayment } from "@/lib/types";

export async function listBookings(
  token: string,
  params?: { venueId?: string; status?: string },
) {
  const q = new URLSearchParams();
  if (params?.venueId) q.set("venueId", params.venueId);
  if (params?.status) q.set("status", params.status);
  const suffix = q.toString() ? `?${q}` : "";
  return apiRequest<{ ok: true; bookings: AdminBooking[] }>(
    `/admin/bookings${suffix}`,
    { token },
  );
}

export async function cancelBooking(
  token: string,
  bookingId: string,
  reason?: string,
) {
  return apiRequest<{ ok: true; booking: AdminBooking }>(
    `/admin/bookings/${bookingId}/cancel`,
    { method: "POST", token, body: { reason } },
  );
}

export async function listPayments(token: string) {
  return apiRequest<{ ok: true; payments: AdminPayment[] }>("/admin/payments", {
    token,
  });
}

export async function refundPayment(
  token: string,
  paymentId: string,
  reason?: string,
) {
  return apiRequest<{ ok: true; payment: AdminPayment }>(
    `/admin/payments/${paymentId}/refund`,
    { method: "POST", token, body: { reason } },
  );
}
