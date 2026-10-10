import { apiRequest } from "@/lib/api/client";
import type { AdminBooking, AdminPayment } from "@/lib/types";

export type OverviewStats = {
  activeVenues: number;
  sessions: number;
  confirmed: number;
  pendingPayment: number;
};

export type AttentionItem = {
  id: string;
  label: string;
  href: string;
};

export async function fetchOverview(token: string) {
  return apiRequest<{
    ok: true;
    stats: OverviewStats;
    attention: AttentionItem[];
    recentBookings: AdminBooking[];
    recentPayments: AdminPayment[];
  }>("/admin/overview", { token });
}
