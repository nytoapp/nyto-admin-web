import { apiRequest } from "@/lib/api/client";
import type { AdminBooking, AdminPayment } from "@/lib/types";

export type OverviewStats = {
  upcomingNights: number;
  confirmedBookingsUpcoming: number;
  seatsSold: number;
  seatsCapacity: number;
  occupancyPct: number | null;
  paymentsPending: number;
  paymentsFailed: number;
};

export type OverviewFinance = {
  currency: "INR";
  capturedAmount: number;
  pendingAmount: number;
  refundedAmount: number;
};

export type OverviewScope = {
  timezone: string;
  upcomingWindowDays: number;
  asOf: string;
  windowEnd: string;
};

export type AttentionItem = {
  id: string;
  label: string;
  href: string;
  entity?: string;
  count?: number;
};

/** Normalized Overview payload — supports current + legacy `/admin/overview` shapes. */
export type NormalizedOverview = {
  contract: "upcoming_ops" | "legacy_pulse";
  scope: OverviewScope | null;
  stats: OverviewStats | null;
  /** Legacy-only fields when contract is legacy_pulse. */
  legacy?: {
    activeVenues: number;
    nightsAllNonCancelled: number;
    confirmedAllTime: number;
    bookingsAwaitingPayment: number;
  };
  finance: OverviewFinance | null;
  attention: AttentionItem[];
  attentionVerified: boolean;
  recentBookings: AdminBooking[];
  recentPayments: AdminPayment[];
};

type RawOverview = {
  ok?: boolean;
  scope?: OverviewScope;
  stats?: Record<string, number | null | undefined>;
  finance?: OverviewFinance;
  attention?: AttentionItem[];
  recentBookings?: AdminBooking[];
  recentPayments?: AdminPayment[];
};

export function normalizeOverviewResponse(raw: RawOverview): NormalizedOverview {
  const attention = Array.isArray(raw.attention) ? raw.attention : [];
  const recentBookings = Array.isArray(raw.recentBookings)
    ? raw.recentBookings
    : [];
  const recentPayments = Array.isArray(raw.recentPayments)
    ? raw.recentPayments
    : [];

  const s = raw.stats ?? {};
  const hasUpcoming =
    typeof s.upcomingNights === "number" &&
    typeof s.confirmedBookingsUpcoming === "number";

  if (hasUpcoming) {
    const seatsSold = Number(s.seatsSold ?? 0);
    const seatsCapacity = Number(s.seatsCapacity ?? 0);
    const occupancyPct =
      typeof s.occupancyPct === "number"
        ? s.occupancyPct
        : seatsCapacity > 0
          ? Math.min(100, Math.round((seatsSold / seatsCapacity) * 100))
          : null;

    return {
      contract: "upcoming_ops",
      scope: raw.scope ?? {
        timezone: "Asia/Kolkata",
        upcomingWindowDays: 30,
        asOf: new Date().toISOString(),
        windowEnd: new Date().toISOString(),
      },
      stats: {
        upcomingNights: Number(s.upcomingNights),
        confirmedBookingsUpcoming: Number(s.confirmedBookingsUpcoming),
        seatsSold,
        seatsCapacity,
        occupancyPct,
        paymentsPending: Number(s.paymentsPending ?? 0),
        paymentsFailed: Number(s.paymentsFailed ?? 0),
      },
      finance: raw.finance ?? null,
      attention,
      attentionVerified: true,
      recentBookings,
      recentPayments,
    };
  }

  // Legacy pulse shape: activeVenues / sessions / confirmed / pendingPayment
  return {
    contract: "legacy_pulse",
    scope: null,
    stats: null,
    legacy: {
      activeVenues: Number(s.activeVenues ?? 0),
      nightsAllNonCancelled: Number(s.sessions ?? 0),
      confirmedAllTime: Number(s.confirmed ?? 0),
      bookingsAwaitingPayment: Number(s.pendingPayment ?? 0),
    },
    finance: raw.finance ?? null,
    attention,
    attentionVerified: Array.isArray(raw.attention),
    recentBookings,
    recentPayments,
  };
}

export async function fetchOverview(token: string) {
  const raw = await apiRequest<RawOverview>("/admin/overview", { token });
  return normalizeOverviewResponse(raw);
}
